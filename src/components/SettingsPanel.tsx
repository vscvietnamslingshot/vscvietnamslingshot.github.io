import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { DistanceConfig, Athlete, MatchHistoryItem, StoredAthleteList } from "../types";
import { Settings, Plus, Edit2, Trash2, Calendar, FileDown, FileUp, RefreshCw, Trophy, Bolt, PlusCircle, Smartphone, CheckCircle, Users, Lock, Unlock, X, AlertTriangle, Shield } from "lucide-react";
import { getHitCount } from "../utils/qualification";
import { auth } from "../firebase";
import { createOnlineTournament, updateOnlineTournament } from "../lib/firebaseService";
import { useLanguage } from "../context/LanguageContext";

interface SettingsPanelProps {
  matchName: string;
  setMatchName: (name: string) => void;
  distances: DistanceConfig[];
  setDistances: (distances: DistanceConfig[]) => void;
  shotsCount: number;
  setShotsCount: (count: number) => void;
  athletes: Athlete[];
  setAthletes: (athletes: Athlete[]) => void;
  masterAthletes: Athlete[];
  setMasterAthletes: (athletes: Athlete[]) => void;
  history: MatchHistoryItem[];
  setHistory: (history: MatchHistoryItem[]) => void;
  onSaveCurrentSessionToHistory: (customName?: string) => void;
  onResetSession: () => void;
  onImportBackup: (data: string) => boolean;
  storedAthleteLists: StoredAthleteList[];
  setStoredAthleteLists: React.Dispatch<React.SetStateAction<StoredAthleteList[]>>;
  activeHistoryId: string | null;
  setActiveHistoryId: (id: string | null) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  bannerUrl: string;
  setBannerUrl: (url: string) => void;
  avatarUrl: string;
  setAvatarUrl: (url: string) => void;
  
  // New Team mode configurations
  teamDistances: DistanceConfig[];
  setTeamDistances: (distances: DistanceConfig[]) => void;
  teamShotsCount: number;
  setTeamShotsCount: (count: number) => void;
  teamAthletes: Athlete[];
  setTeamAthletes: (athletes: Athlete[]) => void;
  directMaxShots: number;
  setDirectMaxShots: (max: number) => void;
  teamDirectMaxShots: number;
  setTeamDirectMaxShots: (max: number) => void;
  directMaxPoints: number | undefined;
  setDirectMaxPoints: (max: number | undefined) => void;
  teamDirectMaxPoints: number | undefined;
  setTeamDirectMaxPoints: (max: number | undefined) => void;
  referees?: string[];
  onUpdateReferees?: (refList: string[]) => void;
  subAdmins?: string[];
  onUpdateSubAdmins?: (subList: string[]) => void;
  isNewTournamentModalOpen?: boolean;
  setIsNewTournamentModalOpen?: (open: boolean) => void;
  setInputAthletes?: (athletes: Athlete[]) => void;
  setTeamInputAthletes?: (athletes: Athlete[]) => void;
  setClubs?: React.Dispatch<React.SetStateAction<any[]>>;
  tournamentType?: "individual" | "team" | "combined";
  setTournamentType?: (type: "individual" | "team" | "combined") => void;
  laneCapacity?: number;
  setLaneCapacity?: (capacity: number) => void;
  setActiveTab?: (tab: any) => void;
  onExitTournament?: () => void;
}

const compressImage = (base64Str: string, maxWidth = 150, maxHeight = 150): Promise<string> => {
  return new Promise((resolve) => {
    if (!base64Str || !base64Str.startsWith("data:image")) {
      resolve(base64Str);
      return;
    }
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  matchName,
  setMatchName,
  distances,
  setDistances,
  shotsCount,
  setShotsCount,
  athletes,
  setAthletes,
  masterAthletes,
  setMasterAthletes,
  history,
  setHistory,
  onSaveCurrentSessionToHistory,
  onResetSession,
  onImportBackup,
  storedAthleteLists,
  setStoredAthleteLists,
  activeHistoryId,
  setActiveHistoryId,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  bannerUrl,
  setBannerUrl,
  avatarUrl,
  setAvatarUrl,
  setClubs,
  teamDistances,
  setTeamDistances,
  teamShotsCount,
  setTeamShotsCount,
  teamAthletes,
  setTeamAthletes,
  directMaxShots,
  setDirectMaxShots,
  teamDirectMaxShots,
  setTeamDirectMaxShots,
  directMaxPoints,
  setDirectMaxPoints,
  teamDirectMaxPoints,
  setTeamDirectMaxPoints,
  referees,
  onUpdateReferees,
  subAdmins,
  onUpdateSubAdmins,
  isNewTournamentModalOpen: externalIsNewTournamentModalOpen,
  setIsNewTournamentModalOpen: externalSetIsNewTournamentModalOpen,
  setInputAthletes,
  setTeamInputAthletes,
  tournamentType = "combined",
  setTournamentType,
  laneCapacity: propLaneCapacity,
  setLaneCapacity: propSetLaneCapacity,
  setActiveTab,
  onExitTournament,
}) => {
  const { language } = useLanguage();
  const [tempMatchName, setTempMatchName] = useState(matchName);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Individual fields
  const [newDistanceStr, setNewDistanceStr] = useState("");
  const [newMultiplierVal, setNewMultiplierVal] = useState(10);
  const [newIsCumulative, setNewIsCumulative] = useState(false);
  const [newIsElimination, setNewIsElimination] = useState(false);
  const [newIsMaxRoundScore, setNewIsMaxRoundScore] = useState(false);
  const [newEliminationType, setNewEliminationType] = useState<"count" | "percent">("percent");
  const [newEliminationValue, setNewEliminationValue] = useState(50);
  const [newIsSolo, setNewIsSolo] = useState(false);

  // Team fields
  const [newTeamDistanceStr, setNewTeamDistanceStr] = useState("");
  const [newTeamMultiplierVal, setNewTeamMultiplierVal] = useState(10);
  const [newTeamIsCumulative, setNewTeamIsCumulative] = useState(false);
  const [newTeamIsElimination, setNewTeamIsElimination] = useState(false);
  const [newTeamIsMaxRoundScore, setNewTeamIsMaxRoundScore] = useState(false);
  const [newTeamEliminationType, setNewTeamEliminationType] = useState<"count" | "percent">("percent");
  const [newTeamEliminationValue, setNewTeamEliminationValue] = useState(50);
  const [newTeamIsSolo, setNewTeamIsSolo] = useState(false);

  const [editingDistanceId, setEditingDistanceId] = useState<string | null>(null);
  const [editingDistanceType, setEditingDistanceType] = useState<"individual" | "team" | null>(null);
  const [editingDistanceStr, setEditingDistanceStr] = useState("");
  const [editingMultiplierVal, setEditingMultiplierVal] = useState(10);
  const [editingIsCumulative, setEditingIsCumulative] = useState(false);
  const [editingIsElimination, setEditingIsElimination] = useState(false);
  const [editingIsMaxRoundScore, setEditingIsMaxRoundScore] = useState(false);
  const [editingEliminationType, setEditingEliminationType] = useState<"count" | "percent">("percent");
  const [editingEliminationValue, setEditingEliminationValue] = useState(50);
  const [editingIsSolo, setEditingIsSolo] = useState(false);

  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState(false);

  const [confirmDeleteDistanceId, setConfirmDeleteDistanceId] = useState<string | null>(null);
  const [confirmDeleteDistanceType, setConfirmDeleteDistanceType] = useState<"individual" | "team" | null>(null);
  const [distanceError, setDistanceError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const distanceToDelete = confirmDeleteDistanceId 
    ? (confirmDeleteDistanceType === "individual" 
        ? distances.find(d => d.id === confirmDeleteDistanceId) 
        : teamDistances.find(d => d.id === confirmDeleteDistanceId))
    : null;
  const [confirmCreateNew, setConfirmCreateNew] = useState(false);
  const [newTournamentName, setNewTournamentName] = useState("");
  const [tournamentError, setTournamentError] = useState("");

  // States for tracking configuration changes before locking
  const [snapshotMatchName, setSnapshotMatchName] = useState<string>("");
  const [snapshotTournamentDesc, setSnapshotTournamentDesc] = useState<string>("");
  const [snapshotLaneCapacity, setSnapshotLaneCapacity] = useState<number>(10);
  const [snapshotShotsCount, setSnapshotShotsCount] = useState<number>(5);
  const [snapshotTeamShotsCount, setSnapshotTeamShotsCount] = useState<number>(5);
  const [isConfirmLockModalOpen, setIsConfirmLockModalOpen] = useState(false);
  const [lockPendingChanges, setLockPendingChanges] = useState<string[]>([]);

  // States for Tournament Configuration
  const [tournamentId, setTournamentId] = useState<string>(() => {
    let saved = localStorage.getItem("slingshot_active_tournament_id");
    if (!saved) {
      const currentSeqStr = localStorage.getItem("slingshot_active_tournament_seq") || "1";
      const paddedStr = currentSeqStr.padStart(4, "0");
      saved = `G-${paddedStr}`;
      localStorage.setItem("slingshot_active_tournament_id", saved);
      localStorage.setItem("slingshot_active_tournament_seq", currentSeqStr);
    }
    return saved;
  });
  const [tournamentDesc, setTournamentDesc] = useState<string>(() => {
    return localStorage.getItem("slingshot_active_tournament_desc") || "Giải Bắn Ná Hoàn Toàn Tự Do Và Chuyên Nghiệp. Áp dụng luật tính điểm luỹ kế.";
  });
  const [isTournamentLocked, setIsTournamentLocked] = useState<boolean>(() => {
    const saved = localStorage.getItem("slingshot_active_tournament_is_locked");
    return saved !== "false"; // default to locked (true)
  });
  const [localLaneCapacity, setLocalLaneCapacity] = useState<number>(() => {
    const saved = localStorage.getItem("slingshot_active_tournament_lane_capacity");
    return saved ? Number(saved) : 10;
  });
  const laneCapacity = propLaneCapacity !== undefined ? propLaneCapacity : localLaneCapacity;
  const setLaneCapacityValue = (val: number) => {
    if (propSetLaneCapacity) {
      propSetLaneCapacity(val);
    } else {
      setLocalLaneCapacity(val);
    }
    localStorage.setItem("slingshot_active_tournament_lane_capacity", val.toString());
  };

  // Modal State for started tournament
  const [localIsNewTournamentModalOpen, setLocalIsNewTournamentModalOpen] = useState(false);
  const isNewTournamentModalOpen = externalIsNewTournamentModalOpen !== undefined ? externalIsNewTournamentModalOpen : localIsNewTournamentModalOpen;
  const setIsNewTournamentModalOpen = externalSetIsNewTournamentModalOpen !== undefined ? externalSetIsNewTournamentModalOpen : setLocalIsNewTournamentModalOpen;

  const [modalTournamentId, setModalTournamentId] = useState("");
  const [modalTournamentName, setModalTournamentName] = useState("");
  const [modalTournamentDesc, setModalTournamentDesc] = useState("");
  const [modalStartDate, setModalStartDate] = useState("");
  const [modalEndDate, setModalEndDate] = useState("");
  const [modalLaneCapacity, setModalLaneCapacity] = useState(10);
  const [modalShotsCount, setModalShotsCount] = useState(5);
  const [modalTeamShotsCount, setModalTeamShotsCount] = useState(5);
  const [modalTournamentType, setModalTournamentType] = useState<"individual" | "team" | "combined">("combined");

  useEffect(() => {
    if (isNewTournamentModalOpen && !modalTournamentId) {
      const todayStr = new Date().toLocaleDateString("vi-VN");
      const currentSeqStr = localStorage.getItem("slingshot_active_tournament_seq") || "1";
      const nextSeq = Number(currentSeqStr) + 1;
      const nextSeqStr = nextSeq.toString().padStart(4, "0");
      setModalTournamentId(`G-${nextSeqStr}`);
      setModalTournamentName(matchName ? `${matchName} (${todayStr})` : `Giải đấu ${todayStr}`);
      setModalTournamentDesc(language === "en" ? "Standard competition structure." : "Áp dụng cơ cấu thi đấu chuẩn VSC.");
      setModalStartDate("");
      setModalEndDate("");
      setModalLaneCapacity(laneCapacity);
      setModalShotsCount(shotsCount);
      setModalTeamShotsCount(teamShotsCount);
      setModalTournamentType("combined");
      setTournamentError("");
    } else if (!isNewTournamentModalOpen) {
      setModalTournamentId("");
    }
  }, [isNewTournamentModalOpen, laneCapacity, shotsCount, teamShotsCount]);

  useEffect(() => {
    if (isTournamentLocked) {
      setTempMatchName(matchName);
      setSnapshotMatchName("");
      setSnapshotTournamentDesc("");
      setSnapshotLaneCapacity(10);
      setSnapshotShotsCount(5);
      setSnapshotTeamShotsCount(5);
    }
  }, [matchName, isTournamentLocked]);

  const handleSaveMatchName = () => {
    const trimmed = tempMatchName.trim();
    if (!trimmed) return;

    const oldName = matchName.trim();
    if (oldName && oldName.toLowerCase() !== trimmed.toLowerCase()) {
      setStoredAthleteLists((prev) => {
        return prev.map((item) => {
          if (item.name.trim().toLowerCase() === oldName.toLowerCase()) {
            return { ...item, name: trimmed };
          }
          return item;
        });
      });

      setHistory((prev) => {
        return prev.map((item) => {
          if (item.matchName.trim().toLowerCase() === oldName.toLowerCase()) {
            return { ...item, matchName: trimmed };
          }
          return item;
        });
      });
    }

    setMatchName(trimmed);
  };

  // Add individual distance safely
  const handleAddDistance = () => {
    if (!newDistanceStr.trim()) return;
    
    const newId = `dist-${Date.now()}`;
    const newDist: DistanceConfig = {
      id: newId,
      distance: newDistanceStr.trim(),
      multiplier: Number(newMultiplierVal) || 10,
      isCumulative: newIsCumulative,
      isElimination: newIsElimination,
      isMaxRoundScore: newIsMaxRoundScore,
      eliminationType: newEliminationType,
      eliminationValue: newIsElimination ? (newEliminationValue || 50) : undefined,
      isSolo: newIsSolo,
    };

    const updatedDistances = [...distances, newDist];
    setDistances(updatedDistances);

    const updatedAthletes = athletes.map((athlete) => {
      const newScores = { ...athlete.scores };
      newScores[newId] = Array(shotsCount).fill(null);
      return {
        ...athlete,
        scores: newScores,
      };
    });
    setAthletes(updatedAthletes);

    // Clear form inputs
    setNewDistanceStr("");
    setNewMultiplierVal(10);
    setNewIsCumulative(false);
    setNewIsElimination(false);
    setNewIsMaxRoundScore(false);
    setNewEliminationType("percent");
    setNewEliminationValue(50);
    setNewIsSolo(false);
  };

  // Add team distance safely
  const handleAddTeamDistance = () => {
    if (!newTeamDistanceStr.trim()) return;
    
    const newId = `dist-team-${Date.now()}`;
    const newDist: DistanceConfig = {
      id: newId,
      distance: newTeamDistanceStr.trim(),
      multiplier: Number(newTeamMultiplierVal) || 10,
      isCumulative: newTeamIsCumulative,
      isElimination: newTeamIsElimination,
      isMaxRoundScore: newTeamIsMaxRoundScore,
      eliminationType: newTeamEliminationType,
      eliminationValue: newTeamIsElimination ? (newTeamEliminationValue || 50) : undefined,
      isSolo: newTeamIsSolo,
    };

    const updatedDistances = [...teamDistances, newDist];
    setTeamDistances(updatedDistances);

    const updatedAthletes = teamAthletes.map((athlete) => {
      const newScores = { ...athlete.scores };
      newScores[newId] = Array(teamShotsCount).fill(null);
      return {
        ...athlete,
        scores: newScores,
      };
    });
    setTeamAthletes(updatedAthletes);

    // Clear form inputs
    setNewTeamDistanceStr("");
    setNewTeamMultiplierVal(10);
    setNewTeamIsCumulative(false);
    setNewTeamIsElimination(false);
    setNewTeamIsMaxRoundScore(false);
    setNewTeamEliminationType("percent");
    setNewTeamEliminationValue(50);
    setNewTeamIsSolo(false);
  };

  // Safe adjust of shots count for individuals (1 to 30)
  const handleShotsCountChange = (newCount: number) => {
    if (newCount < 1 || newCount > 30) return;
    const updatedAthletes = athletes.map((athlete) => {
      const newScores: Record<string, (boolean | null)[]> = {};
      distances.forEach((dist) => {
        const existingScores = athlete.scores[dist.id] || [];
        if (existingScores.length === newCount) {
          newScores[dist.id] = existingScores;
        } else if (existingScores.length < newCount) {
          newScores[dist.id] = [...existingScores, ...Array(newCount - existingScores.length).fill(null)];
        } else {
          newScores[dist.id] = existingScores.slice(0, newCount);
        }
      });
      return {
        ...athlete,
        scores: newScores,
      };
    });
    setShotsCount(newCount);
    setAthletes(updatedAthletes);
  };

  // Safe adjust of shots count for team (1 to 30)
  const handleTeamShotsCountChange = (newCount: number) => {
    if (newCount < 1 || newCount > 30) return;
    const updatedAthletes = teamAthletes.map((athlete) => {
      const newScores: Record<string, (boolean | null)[]> = {};
      teamDistances.forEach((dist) => {
        const existingScores = athlete.scores[dist.id] || [];
        if (existingScores.length === newCount) {
          newScores[dist.id] = existingScores;
        } else if (existingScores.length < newCount) {
          newScores[dist.id] = [...existingScores, ...Array(newCount - existingScores.length).fill(null)];
        } else {
          newScores[dist.id] = existingScores.slice(0, newCount);
        }
      });
      return {
        ...athlete,
        scores: newScores,
      };
    });
    setTeamShotsCount(newCount);
    setTeamAthletes(updatedAthletes);
  };

  // Export fully verified JSON containing both Individual and Team mode database snapshots
  const handleExportJSON = () => {
    const currentSession = {
      matchName,
      distances,
      shotsCount,
      athletes,
      teamDistances,
      teamShotsCount,
      teamAthletes,
    };
    const jsonString = JSON.stringify(currentSession, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `slingshot-scoring_${matchName.replace(/\s+/g, "-")}_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export inclusive CSV covering both brackets
  const handleExportCSV = () => {
    let csvContent = "\ufeff"; // BOM for excel utf8
    csvContent += "HẠNG MỤC,MÃ SỐ,HỌ TÊN,ĐỘI / CLB,CỰ LY,ĐIỂM NHÂN,LƯỢT TRÚNG,TỔNG PHÁT BẮN,CHI TIẾT LƯỢT,ĐIỂM DÒNG,TỔNG ĐIỂM VĐV\n";

    // Individual records
    athletes.forEach((athlete) => {
      let totalScore = 0;
      distances.forEach((dist) => {
        const hits = athlete.scores[dist.id] || [];
        const hitCount = getHitCount(hits);
        totalScore += hitCount * dist.multiplier;
      });

      distances.forEach((dist, idx) => {
        const hits = athlete.scores[dist.id] || [];
        const hitCount = getHitCount(hits);
        const rowScore = hitCount * dist.multiplier;
        const hitDetails = hits.map(h => typeof h === "number" ? h.toString() : (h ? "1" : "0")).join("|");

        csvContent += `"Cá Nhân","${athlete.id}","${athlete.name}","${athlete.team}","${dist.distance}",${dist.multiplier},${hitCount},${shotsCount},"${hitDetails}",${rowScore},${idx === 0 ? totalScore : ""}\n`;
      });
    });

    // Team records
    teamAthletes.forEach((athlete) => {
      let totalScore = 0;
      teamDistances.forEach((dist) => {
        const hits = athlete.scores[dist.id] || [];
        const hitCount = getHitCount(hits);
        totalScore += hitCount * dist.multiplier;
      });

      teamDistances.forEach((dist, idx) => {
        const hits = athlete.scores[dist.id] || [];
        const hitCount = getHitCount(hits);
        const rowScore = hitCount * dist.multiplier;
        const hitDetails = hits.map(h => typeof h === "number" ? h.toString() : (h ? "1" : "0")).join("|");

        csvContent += `"Đồng Đội","${athlete.id}","${athlete.name}","${athlete.team}","${dist.distance}",${dist.multiplier},${hitCount},${teamShotsCount},"${hitDetails}",${rowScore},${idx === 0 ? totalScore : ""}\n`;
      });
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `slingshot-scoring-leaderboard_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`grid grid-cols-1 ${
      tournamentType === "combined" ? "lg:grid-cols-3" : "lg:grid-cols-2"
    } gap-6`}>
      
      {/* 1. General Setup & Integrated Backup/Export (Gộp chung theo yêu cầu) */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col gap-4">
        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b pb-2 mb-1">
          <Settings className="w-4.5 h-4.5 text-blue-600" />
          {language === "en" ? "Tournament Configuration" : "Cấu Hình Giải Đấu"}
        </h3>

        {isTournamentLocked ? (
          /* LOCKED MODE VIEW */
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-150 dark:border-emerald-900/60 p-2.5 rounded-xl text-xs font-bold text-emerald-850 dark:text-emerald-400">
              <span className="flex items-center gap-1.5 font-black uppercase text-[10px] tracking-wider">
                <Lock className="w-3.5 h-3.5" /> 
                {language === "en" ? "Configuration Locked" : "Cấu hình đã khóa"}
              </span>
              <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded text-emerald-800 dark:text-emerald-300 font-extrabold">{language === "en" ? "SECURE MODE" : "BẢO VỆ AT"}</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-gray-150 dark:border-slate-800 space-y-2">
              <div>
                <span className="block text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">{language === "en" ? "TOURNAMENT ID:" : "ID GIẢI ĐẤU:"}</span>
                <span className="text-xs font-mono font-black text-slate-800 dark:text-white bg-slate-200/60 dark:bg-slate-900 px-1.5 py-0.5 rounded leading-tight inline-block mt-0.5">{tournamentId}</span>
              </div>
              
              <div>
                <span className="block text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">{language === "en" ? "TOURNAMENT NAME:" : "TÊN GIẢI ĐẤU:"}</span>
                <span className="text-xs font-black text-indigo-700 dark:text-indigo-400 block mt-0.5">{matchName}</span>
              </div>

              <div>
                <span className="block text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">{language === "en" ? "TOURNAMENT FORMAT:" : "CƠ CHẾ GIẢI ĐẤU:"}</span>
                <span className="text-xs font-black text-amber-600 dark:text-amber-400 block mt-0.5">
                  {tournamentType === "individual" && (language === "en" ? "Individual (Individual view only)" : "Cá Nhân (Chỉ hiển thị môi trường Cá Nhân)")}
                  {tournamentType === "team" && (language === "en" ? "Team (Team view only)" : "Đồng Đội (Chỉ hiển thị môi trường Đồng Đội)")}
                  {tournamentType === "combined" && (language === "en" ? "Individual + Team (Combined)" : "Cá Nhân + Đồng Đội (Kết Hợp)")}
                </span>
              </div>

              <div>
                <span className="block text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">{language === "en" ? "DETAILS & SCORING RULES:" : "CHI TIẾT & LUẬT BẮN:"}</span>
                <div className="text-xs text-slate-650 dark:text-gray-300 italic mt-0.5 max-h-24 overflow-y-auto whitespace-pre-wrap leading-relaxed pr-1 font-medium">{tournamentDesc || (language === "en" ? "No description provided." : "Chưa có diễn giải chi tiết.")}</div>
              </div>

              <div className={`grid ${
                tournamentType === "combined" ? "grid-cols-3" : "grid-cols-2"
              } gap-2 pt-1 border-t border-gray-100 dark:border-slate-800/80`}>
                <div>
                  <span className="block text-[8px] text-gray-500 font-extrabold uppercase tracking-widest leading-normal">{language === "en" ? "ATHLETES / LANE" : "VĐV / LANE (X)"}</span>
                  <span className="text-xs font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5 block">{laneCapacity}</span>
                </div>
                {tournamentType !== "team" && (
                  <div>
                    <span className="block text-[8px] text-gray-500 font-extrabold uppercase tracking-widest leading-normal">{language === "en" ? "INDIVIDUAL SHOTS" : "CỘT CÁ NHÂN"}</span>
                    <span className="text-xs font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5 block">{shotsCount} {language === "en" ? "shots" : "lượt"}</span>
                  </div>
                )}
                {tournamentType !== "individual" && (
                  <div>
                    <span className="block text-[8px] text-gray-500 font-extrabold uppercase tracking-widest leading-normal">{language === "en" ? "TEAM SHOTS" : "CỘT ĐỒNG ĐỘI"}</span>
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5 block">{teamShotsCount} {language === "en" ? "shots" : "lượt"}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsTournamentLocked(false);
                setTempMatchName(matchName);
                setSnapshotMatchName(matchName);
                setSnapshotTournamentDesc(tournamentDesc);
                setSnapshotLaneCapacity(laneCapacity);
                setSnapshotShotsCount(shotsCount);
                setSnapshotTeamShotsCount(teamShotsCount);
              }}
              className="w-full py-1.5 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-gray-300 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-98"
            >
              <Unlock className="w-3.5 h-3.5 text-amber-500" />
              {language === "en" ? "Unlock Quick Edit" : "Mở Khóa Chỉnh Sửa Nhanh"}
            </button>
          </div>
        ) : (
          /* UNLOCKED / EDITABLE MODE VIEW */
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-2.5 rounded-xl text-xs font-bold text-amber-850 dark:text-amber-400">
              <span className="flex items-center gap-1.5 font-black uppercase text-[10px] tracking-wider">
                <Unlock className="w-3.5 h-3.5" /> 
                {language === "en" ? "Editing Mode Active" : "Chế độ chỉnh sửa đang mở"}
              </span>
              <span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded font-extrabold uppercase animate-pulse">{language === "en" ? "WARNING" : "Chú ý chạm"}</span>
            </div>

            {/* ID Input */}
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 flex justify-between">
                <span>{language === "en" ? "Tournament ID Code" : "Mã ID Giải Đấu"}</span>
                <span className="text-[8px] bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-gray-400 px-1 py-0.5 rounded font-black font-mono">{language === "en" ? "AUTO GENERATED" : "LỢI ÍCH TỰ ĐỘNG"}</span>
              </label>
              <input
                type="text"
                value={tournamentId}
                readOnly
                className="w-full px-3 py-1.5 text-xs bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-850 rounded-lg text-slate-500 font-mono font-black cursor-not-allowed outline-none select-none"
              />
            </div>

            {/* Tournament Name Input */}
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{language === "en" ? "Tournament Name" : "Tên Giải Đấu"}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tempMatchName}
                  onChange={(e) => setTempMatchName(e.target.value)}
                  placeholder={language === "en" ? "e.g. Vietnam Slingshot Championship" : "e.g. Giải Slingshot Việt Nam"}
                  className="flex-1 px-3 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                />
                {tempMatchName.trim() !== matchName.trim() && tempMatchName.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={handleSaveMatchName}
                    className="px-3 bg-blue-605 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all cursor-pointer shrink-0"
                  >
                    {language === "en" ? "Save" : "Lưu"}
                  </button>
                )}
              </div>
            </div>

            {/* Tournament Type Select */}
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{language === "en" ? "Tournament Format" : "Cơ Chế Giải Đấu"}</label>
              <select
                value={tournamentType}
                onChange={(e) => {
                  const val = e.target.value as "individual" | "team" | "combined";
                  if (setTournamentType) {
                    setTournamentType(val);
                    localStorage.setItem("slingshot_tournament_type", val);
                    if (activeHistoryId && activeHistoryId.startsWith("tour-") && auth.currentUser) {
                      updateOnlineTournament(activeHistoryId, { tournamentType: val })
                        .catch(err => console.error("Cloud update tournamentType failed:", err));
                    }
                  }
                }}
                className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
              >
                <option value="individual">{language === "en" ? "Individual (Individual view only)" : "Cá Nhân (Chỉ hiển thị môi trường Cá Nhân)"}</option>
                <option value="team">{language === "en" ? "Team (Team view only)" : "Đồng Đội (Chỉ hiển thị môi trường Đồng Đội)"}</option>
                <option value="combined">{language === "en" ? "Individual + Team (Combined)" : "Cá Nhân + Đồng Đội (Kết Hợp)"}</option>
              </select>
            </div>

            {/* Match Dates Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{language === "en" ? "Start Date" : "Ngày Thi Đấu"}</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-505 font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{language === "en" ? "End Date" : "Ngày Kết Thúc"}</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-505 font-bold"
                />
              </div>
            </div>

            {/* Description Textarea */}
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{language === "en" ? "Description & Rules" : "Diễn Giải / Luật Bắn"}</label>
              <textarea
                value={tournamentDesc}
                onChange={(e) => {
                  setTournamentDesc(e.target.value);
                  localStorage.setItem("slingshot_active_tournament_desc", e.target.value);
                }}
                rows={3}
                placeholder={language === "en" ? "Enter rules, formats, or notes..." : "Nhập luật bắn, thể thức, hoặc lưu ý..."}
                className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-505 font-medium leading-relaxed"
              />
            </div>

            {/* Banner & Avatar Upload Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-indigo-50 dark:border-slate-800/80 p-4 rounded-xl bg-indigo-50/10 dark:bg-slate-950/20">
              {/* Avatar upload */}
              <div>
                <label className="block text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1.5">
                  {language === "en" ? "Tournament Logo / Avatar" : "Logo / Avatar Giải Đấu"}
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14 rounded-xl border border-dashed border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Tournament Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Trophy className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 text-[11px] text-white hover:bg-indigo-700 font-bold bg-indigo-600 px-3 py-1.5 rounded-lg transition-all shadow-sm">
                      <span>{language === "en" ? "Upload Logo" : "Tải Logo Lên"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              if (typeof reader.result === "string") {
                                compressImage(reader.result, 180, 180).then((compressed) => {
                                  setAvatarUrl(compressed);
                                });
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => setAvatarUrl("")}
                        className="text-[10px] text-red-600 hover:text-red-700 font-bold text-left pl-1"
                      >
                        {language === "en" ? "Remove" : "Xóa bỏ"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Banner upload */}
              <div>
                <label className="block text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1.5">
                  {language === "en" ? "Tournament Banner" : "Banner Giải Đấu"}
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative w-24 h-14 rounded-xl border border-dashed border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden shrink-0">
                    {bannerUrl ? (
                      <img src={bannerUrl} alt="Tournament Banner" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Calendar className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 text-[11px] text-white hover:bg-indigo-700 font-bold bg-indigo-600 px-3 py-1.5 rounded-lg transition-all shadow-sm">
                      <span>{language === "en" ? "Upload Banner" : "Tải Banner Lên"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              if (typeof reader.result === "string") {
                                compressImage(reader.result, 1000, 400).then((compressed) => {
                                  setBannerUrl(compressed);
                                });
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    {bannerUrl && (
                      <button
                        type="button"
                        onClick={() => setBannerUrl("")}
                        className="text-[10px] text-red-600 hover:text-red-700 font-bold text-left pl-1"
                      >
                        {language === "en" ? "Remove" : "Xóa bỏ"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Show lane capacity selector as an editable element when unlocked */}
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{language === "en" ? "Athletes per LANE" : "Số VĐV / LANE (x)"}</label>
              <input
                type="number"
                min={2}
                max={50}
                value={laneCapacity}
                onChange={(e) => {
                  const val = Math.max(2, Math.min(50, Number(e.target.value) || 10));
                  setLaneCapacityValue(val);
                }}
                className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-505 font-bold"
              />
            </div>

            {/* Individual Shot Count */}
            {tournamentType !== "team" && (
              <div className={`grid grid-cols-1 ${shotsCount === 1 ? "md:grid-cols-3" : "md:grid-cols-2"} gap-4`}>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 flex justify-between">
                    <span>{language === "en" ? "Individual Rounds:" : "Số lượt Cá Nhân:"}</span>
                    <span className="text-blue-600 font-black font-mono">{shotsCount} {language === "en" ? "rds" : "lượt"}</span>
                  </label>
                  <div className="w-full">
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={shotsCount}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(30, Number(e.target.value) || 1));
                        handleShotsCountChange(val);
                      }}
                      className="w-full px-3 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold text-center text-xs"
                    />
                  </div>
                </div>

                {shotsCount === 1 && (
                  <>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                        {language === "en" ? "MAX shots (Individual Rd):" : "Số viên MAX (Lượt Cá Nhân):"}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={directMaxShots}
                        onChange={(e) => setDirectMaxShots(Math.max(1, Number(e.target.value) || 10))}
                        className="w-full px-3 py-1 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold text-xs"
                        placeholder={language === "en" ? "e.g. 10, 15, 20..." : "Ví dụ: 10, 15, 20..."}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                        {language === "en" ? "MAX Points (Individual):" : "Số điểm MAX (Cá Nhân):"}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        value={directMaxPoints !== undefined ? directMaxPoints : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            setDirectMaxPoints(undefined);
                          } else {
                            setDirectMaxPoints(Math.max(1, Number(val)));
                          }
                        }}
                        className="w-full px-3 py-1 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold text-xs"
                        placeholder={language === "en" ? "Empty (Calculated by hits)" : "Trống (Tính theo số viên)"}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Team Shot Count */}
            {tournamentType !== "individual" && (
              <div className={`grid grid-cols-1 ${teamShotsCount === 1 ? "md:grid-cols-3" : "md:grid-cols-2"} gap-4`}>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 flex justify-between">
                    <span>{language === "en" ? "Team Rounds:" : "Số lượt Đồng Đội:"}</span>
                    <span className="text-indigo-600 font-black font-mono">{teamShotsCount} {language === "en" ? "rds" : "lượt"}</span>
                  </label>
                  <div className="w-full">
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={teamShotsCount}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(30, Number(e.target.value) || 1));
                        handleTeamShotsCountChange(val);
                      }}
                      className="w-full px-3 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold text-center text-xs"
                    />
                  </div>
                </div>

                {teamShotsCount === 1 && (
                  <>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                        {language === "en" ? "MAX shots (Team Rd):" : "Số viên MAX (Lượt Đồng Đội):"}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={teamDirectMaxShots}
                        onChange={(e) => setTeamDirectMaxShots(Math.max(1, Number(e.target.value) || 10))}
                        className="w-full px-3 py-1 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold text-xs"
                        placeholder={language === "en" ? "e.g. 10, 15, 20..." : "Ví dụ: 10, 15, 20..."}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                        {language === "en" ? "MAX Points (Team):" : "Số điểm MAX (Đồng Đội):"}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        value={teamDirectMaxPoints !== undefined ? teamDirectMaxPoints : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            setTeamDirectMaxPoints(undefined);
                          } else {
                            setTeamDirectMaxPoints(Math.max(1, Number(val)));
                          }
                        }}
                        className="w-full px-3 py-1 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold text-xs"
                        placeholder={language === "en" ? "Empty (Calculated by hits)" : "Trống (Tính theo số viên)"}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                const changes: string[] = [];
                const currentName = tempMatchName.trim();
                if (currentName && currentName !== snapshotMatchName) {
                  changes.push(language === "en" 
                    ? `Tournament name: "${snapshotMatchName || 'Empty'}" ➔ "${currentName}"`
                    : `Tên giải đấu: "${snapshotMatchName || 'Trống'}" ➔ "${currentName}"`
                  );
                }
                const currentDesc = tournamentDesc.trim();
                const snapDesc = snapshotTournamentDesc.trim();
                if (currentDesc !== snapDesc) {
                  changes.push(language === "en" 
                    ? `Description / Rules: Updated content`
                    : `Diễn giải / Luật bắn: Thay đổi nội dung`
                  );
                }
                if (laneCapacity !== snapshotLaneCapacity) {
                  changes.push(language === "en"
                    ? `Athletes per LANE: ${snapshotLaneCapacity} ➔ ${laneCapacity}`
                    : `Số VĐV / LANE (x): ${snapshotLaneCapacity} ➔ ${laneCapacity}`
                  );
                }
                if (shotsCount !== snapshotShotsCount) {
                  changes.push(language === "en"
                    ? `Individual Rounds: ${snapshotShotsCount} rds ➔ ${shotsCount} rds`
                    : `Số lượt Cá Nhân: ${snapshotShotsCount} lượt ➔ ${shotsCount} lượt`
                  );
                }
                if (teamShotsCount !== snapshotTeamShotsCount) {
                  changes.push(language === "en"
                    ? `Team Rounds: ${snapshotTeamShotsCount} rds ➔ ${teamShotsCount} rds`
                    : `Số lượt Đồng Đội: ${snapshotTeamShotsCount} lượt ➔ ${teamShotsCount} lượt`
                  );
                }

                if (changes.length > 0) {
                  setLockPendingChanges(changes);
                  setIsConfirmLockModalOpen(true);
                } else {
                  setIsTournamentLocked(true);
                  localStorage.setItem("slingshot_active_tournament_is_locked", "true");
                }
              }}
              className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-98"
            >
              <Lock className="w-3.5 h-3.5" />
              {language === "en" ? "Lock Configuration" : "Khóa Cấu Hình Lại"}
            </button>
          </div>
        )}

        {/* RESET & NEW SESSION ACTIONS */}
        <div className="border-t border-gray-100 dark:border-slate-800 pt-3 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="w-full py-1.5 px-2.5 text-xs font-bold bg-amber-50 hover:bg-amber-100 active:scale-98 text-amber-700 dark:bg-amber-950/10 dark:text-amber-400 dark:border-amber-900/60 border border-amber-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" /> 
            {language === "en" ? "Reset All Scores" : "Reset Toàn Bộ Điểm Số"}
          </button>

          {/* Trigger the Modal Popup configuration for clean creation flow */}
          <button
            type="button"
            onClick={() => {
              if (activeHistoryId && onExitTournament) {
                onExitTournament();
              }
              // Populate default fields inside the modal 
              const todayStr = new Date().toLocaleDateString("vi-VN");
              const currentSeqStr = localStorage.getItem("slingshot_active_tournament_seq") || "1";
              const nextSeq = Number(currentSeqStr) + 1;
              const nextSeqStr = nextSeq.toString().padStart(4, "0");
              setModalTournamentId(`G-${nextSeqStr}`);
              setModalTournamentName(`Giải Slingshot Hải Phòng ${todayStr}`);
              setModalTournamentDesc("Bắn loại trực tiếp qua các khoảng cách. Áp dụng cơ cấu thi đấu chuẩn VSC.");
              setModalStartDate("");
              setModalEndDate("");
              setModalLaneCapacity(laneCapacity);
              setModalShotsCount(shotsCount);
              setModalTeamShotsCount(teamShotsCount);
              setTournamentError("");
              setIsNewTournamentModalOpen(true);
            }}
            className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-rose-500/10 active:scale-95"
          >
            <PlusCircle className="w-4.5 h-4.5 animate-pulse" /> 
            {language === "en" ? "Start New Tournament (Open Modal)" : "Bắt đầu giải đấu mới (Mở Modal)"}
          </button>
        </div>

        {/* COMPREHENSIVE BACKUP, IMPORT AND EXPORT TOOL SECTION (Consolidated in Col 1 as requested) */}
        <div className="border-t border-gray-150 pt-4 flex flex-col gap-3">
          <span className="text-xs font-black text-slate-800 dark:text-gray-300 flex items-center gap-2 uppercase tracking-wide">
            <FileDown className="text-blue-600 w-4.5 h-4.5" />
            {language === "en" ? "Storage, Export / Import Backup" : "Lưu Trữ, Xuất / Nhập Backup"}
          </span>

          <button
            onClick={handleExportCSV}
            className="w-full py-2 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            <FileDown className="w-4 h-4" /> {language === "en" ? "Export Scoreboard CSV (Excel)" : "Xuất Bảng Điểm CSV (Excel)"}
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleExportJSON}
              className="flex-1 py-1.5 px-2 text-[11.5px] bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 border rounded font-extrabold flex items-center justify-center gap-1 transition-colors cursor-pointer text-center"
            >
              <FileDown className="w-3.5 h-3.5" /> {language === "en" ? "Download JSON" : "Tải JSON"}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-1.5 px-2 text-[11.5px] bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-900 rounded font-black flex items-center justify-center gap-1 transition-colors cursor-pointer text-center"
            >
              <FileUp className="w-3.5 h-3.5" /> {language === "en" ? "Restore" : "Phục Hồi"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setImportError("");
                setImportSuccess(false);

                const reader = new FileReader();
                reader.onload = (event) => {
                  try {
                    const text = event.target?.result as string;
                    const success = onImportBackup(text);
                    if (success) {
                      setImportSuccess(true);
                      setTimeout(() => setImportSuccess(false), 4500);
                    } else {
                      setImportError(language === "en" ? "Incompatible JSON backup template!" : "Mẫu sao lưu .json không tương thích!");
                    }
                  } catch (err) {
                    setImportError(language === "en" ? "Restore file structure error!" : "Lỗi cấu trúc tệp phục hồi!");
                  }
                };
                reader.readAsText(file);
                e.target.value = "";
              }}
              className="hidden"
            />
          </div>

          {importError && (
            <span className="text-[10px] text-red-650 font-bold block bg-red-50 p-2 rounded border border-red-200 text-center animate-fadeIn">{importError}</span>
          )}
          {importSuccess && (
            <span className="text-[10px] text-emerald-700 font-black block bg-emerald-50 p-2 rounded border border-emerald-200 text-center animate-fadeIn">{language === "en" ? "✓ Fully restored tournament data!" : "✓ Đã phục hồi dữ liệu hoàn chỉnh!"}</span>
          )}

          {/* CLOUD REFEREE MANAGER */}
          {activeHistoryId?.startsWith("tour-") ? (
            <div className="border-t border-gray-150 dark:border-slate-800/60 pt-4 flex flex-col gap-3">
              {/* SUB ADMINS MANAGER */}
              <div className="flex flex-col gap-3 pb-4 border-b border-gray-150 dark:border-slate-800/60">
                <span className="text-[11px] font-black text-indigo-500 uppercase tracking-widest block flex items-center gap-1">
                  <Shield className="w-4 h-4" /> {language === "en" ? "MANAGE SUB ADMINS (CLOUD)" : "QUẢN LÝ SUB ADMIN (CLOUD)"}
                </span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {language === "en" ? "Enter Sub Admin email to grant full administration rights for this online tournament." : "Nhập email của Sub Admin để cấp toàn quyền quản trị cho giải đấu trực tuyến này."}
                </p>
                <div className="flex gap-1.5 font-sans">
                  <input
                    type="email"
                    placeholder="email@subadmin.com"
                    id="subadmin-email-input"
                    className="flex-1 px-2.5 py-1.5 text-xs bg-slate-55 dark:bg-slate-800 border border-slate-205 dark:border-slate-700/80 rounded focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const inputEl = document.getElementById("subadmin-email-input") as HTMLInputElement;
                        const emailStr = inputEl?.value?.trim()?.toLowerCase();
                        if (emailStr && onUpdateSubAdmins) {
                          const currentSubAdmins = subAdmins || [];
                          const lowercasedSubAdmins = currentSubAdmins.map(s => s.toLowerCase());
                          if (lowercasedSubAdmins.includes(emailStr)) {
                            alert(language === "en" ? "This Sub Admin email already exists." : "Email Sub Admin này đã tồn tại.");
                            return;
                          }
                          onUpdateSubAdmins([...currentSubAdmins, emailStr]);
                          inputEl.value = "";
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const inputEl = document.getElementById("subadmin-email-input") as HTMLInputElement;
                      const emailStr = inputEl?.value?.trim()?.toLowerCase();
                      if (emailStr && onUpdateSubAdmins) {
                        const currentSubAdmins = subAdmins || [];
                        const lowercasedSubAdmins = currentSubAdmins.map(s => s.toLowerCase());
                        if (lowercasedSubAdmins.includes(emailStr)) {
                          alert(language === "en" ? "This Sub Admin email already exists." : "Email Sub Admin này đã tồn tại.");
                          return;
                        }
                        onUpdateSubAdmins([...currentSubAdmins, emailStr]);
                        inputEl.value = "";
                      } else if (!emailStr) {
                        alert(language === "en" ? "Please enter a valid email!" : "Vui lòng nhập email hợp lệ!");
                      }
                    }}
                    className="px-3 bg-indigo-600 hover:bg-indigo-750 text-white text-[11px] font-bold rounded-lg cursor-pointer"
                  >
                    {language === "en" ? "Add" : "Thêm"}
                  </button>
                </div>
                {subAdmins && subAdmins.length > 0 ? (
                  <div className="flex flex-col gap-1 max-h-36 overflow-y-auto mt-1 border border-slate-100 dark:border-slate-800 p-2 rounded bg-slate-50/50 dark:bg-slate-950/20">
                    {subAdmins.map((email) => (
                      <div key={email} className="flex justify-between items-center text-xs text-slate-700 dark:text-slate-300">
                        <span className="truncate max-w-[200px] font-mono select-all">{email}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (onUpdateSubAdmins) {
                              onUpdateSubAdmins(subAdmins.filter(s => s !== email));
                            }
                          }}
                          className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                          title={language === "en" ? "Delete Sub Admin" : "Xóa Sub Admin"}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-405 italic">{language === "en" ? "No Sub Admins assigned yet" : "Chưa chỉ định Sub Admin nào"}</p>
                )}
              </div>

              {/* REFEREE MANAGER */}
              <span className="text-[11px] font-black text-indigo-500 uppercase tracking-widest block flex items-center gap-1">
                <Users className="w-4 h-4" /> {language === "en" ? "MANAGE REFEREES (CLOUD)" : "QUẢN LÝ TRỌNG TÀI (CLOUD)"}
              </span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {language === "en" ? "Enter referee email to grant scoring permissions for this online tournament." : "Nhập email của trọng tài để cấp quyền nhập và ghi điểm cho giải đấu trực tuyến này."}
              </p>
              <div className="flex gap-1.5 font-sans">
                <input
                  type="email"
                  placeholder="email@trongtai.com"
                  id="referee-email-input"
                  className="flex-1 px-2.5 py-1.5 text-xs bg-slate-55 dark:bg-slate-800 border border-slate-205 dark:border-slate-700/80 rounded focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const inputEl = document.getElementById("referee-email-input") as HTMLInputElement;
                      const emailStr = inputEl?.value?.trim()?.toLowerCase();
                      if (emailStr && referees && onUpdateReferees) {
                        const lowercasedReferees = referees.map(r => r.toLowerCase());
                        if (lowercasedReferees.includes(emailStr)) {
                          alert(language === "en" ? "This referee email already exists." : "Email trọng tài này đã tồn tại.");
                          return;
                        }
                        onUpdateReferees([...referees, emailStr]);
                        inputEl.value = "";
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const inputEl = document.getElementById("referee-email-input") as HTMLInputElement;
                    const emailStr = inputEl?.value?.trim()?.toLowerCase();
                    if (emailStr && referees && onUpdateReferees) {
                      const lowercasedReferees = referees.map(r => r.toLowerCase());
                      if (lowercasedReferees.includes(emailStr)) {
                        alert(language === "en" ? "This referee email already exists." : "Email trọng tài này đã tồn tại.");
                        return;
                      }
                      onUpdateReferees([...referees, emailStr]);
                      inputEl.value = "";
                    } else if (!emailStr) {
                      alert(language === "en" ? "Please enter a valid email!" : "Vui lòng nhập email hợp lệ!");
                    }
                  }}
                  className="px-3 bg-indigo-600 hover:bg-indigo-750 text-white text-[11px] font-bold rounded-lg cursor-pointer"
                >
                  {language === "en" ? "Add" : "Thêm"}
                </button>
              </div>
              {referees && referees.length > 0 ? (
                <div className="flex flex-col gap-1 max-h-36 overflow-y-auto mt-1 border border-slate-100 dark:border-slate-800 p-2 rounded bg-slate-50/50 dark:bg-slate-950/20">
                  {referees.map((email) => (
                    <div key={email} className="flex justify-between items-center text-xs text-slate-700 dark:text-slate-300">
                      <span className="truncate max-w-[200px] font-mono select-all">{email}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (onUpdateReferees) {
                            onUpdateReferees(referees.filter(r => r !== email));
                          }
                        }}
                        className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                        title={language === "en" ? "Delete Referee" : "Xóa trọng tài"}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-slate-405 italic">{language === "en" ? "No referees assigned yet" : "Chưa chỉ định trọng tài nào"}</p>
              )}
            </div>
          ) : (
            <div className="border-t border-gray-150 dark:border-slate-800/60 pt-4 flex flex-col gap-2">
              <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block flex items-center gap-1">
                <Users className="w-4 h-4 text-slate-400" /> {language === "en" ? "MANAGE REFEREES (CLOUD STATUS)" : "QUẢN LÝ TRỌNG TÀI (MÀU CLOUD)"}
              </span>
              <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/60 rounded-2xl flex flex-col gap-1.5 font-sans">
                <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 text-xs font-black">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                  {language === "en" ? "Cloud Referee Feature" : "Tính năng Trọng tài Đám mây (Cloud)"}
                </div>
                <p className="text-[11px] text-slate-501 dark:text-slate-400 leading-relaxed">
                  {language === "en" ? "To allow referees to enter scores from different phones/tablets, you need to publish this tournament online." : "Để cấp quyền cho trọng tài nhập điểm từ các máy điện thoại/máy tính bảng khác nhau, bạn cần đưa giải đấu này trực tuyến."}
                </p>
                <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold mt-0.5">
                  👉 {language === "en" ? "How to activate: Go to Home -> Click 'Publish Tournament to Cloud' or switch to an online tournament." : "Cách kích hoạt: Vào Trang Chủ &rarr; Nhấp nút \"Đăng giải đấu lên Cloud\" hoặc đổi sang giải đấu trực tuyến."}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 2. Individual Distance & Scopes Management */}
      {tournamentType !== "team" && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col gap-4">
        <h3 className="text-base font-bold text-gray-950 dark:text-white flex items-center gap-2 border-b pb-2 mb-1 uppercase tracking-wide">
          <Bolt className="w-4.5 h-4.5 text-blue-600" />
          {language === "en" ? "Individual Distance" : "Cự Ly Cá Nhân"}
        </h3>

        {/* List of individual distances */}
        {distanceError && (
          <div className="bg-rose-50 border border-rose-100 rounded-lg p-2 text-rose-700 font-bold text-[10.5px] leading-tight animate-fadeIn">
            {distanceError}
          </div>
        )}
        
        <div className="flex-1 flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1">
          {distances.map((dist, distIdx) => (
            <div 
              key={dist.id} 
              className="flex flex-col gap-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-850 rounded p-3 text-sm transition-all"
            >
              {editingDistanceId === dist.id && editingDistanceType === "individual" ? (
                <div className="flex flex-col gap-2.5 animate-fadeIn w-full">
                   <div className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                    ✏️ {language === "en" ? `Edit Individual Distance (Round ${distIdx + 1})` : `Sửa Cự Ly Cá Nhân (Vòng ${distIdx + 1})`}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-gray-400 block mb-0.5">{language === "en" ? "Distance name:" : "Tên cự ly:"}</span>
                      <input
                        type="text"
                        value={editingDistanceStr}
                        onChange={(e) => setEditingDistanceStr(e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block mb-0.5">{language === "en" ? "Multiplier:" : "Điểm nhân:"}</span>
                      <input
                        type="number"
                        value={editingMultiplierVal}
                        onChange={(e) => setEditingMultiplierVal(Math.max(1, Number(e.target.value)))}
                        className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-705 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 mt-0.5">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-650 dark:text-gray-350 select-none">
                      <input
                        type="checkbox"
                        checked={editingIsMaxRoundScore}
                        onChange={(e) => setEditingIsMaxRoundScore(e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{language === "en" ? "MAX points of rounds" : "Max điểm các vòng"}</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-650 dark:text-gray-350 select-none">
                      <input
                        type="checkbox"
                        checked={editingIsCumulative}
                        onChange={(e) => setEditingIsCumulative(e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{language === "en" ? "Cumulative points from previous round" : "Cộng dồn điểm từ vòng trước"}</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-650 dark:text-gray-350 select-none">
                      <input
                        type="checkbox"
                        checked={editingIsElimination}
                        onChange={(e) => setEditingIsElimination(e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{language === "en" ? "Apply direct elimination (Cut)" : "Áp dụng loại trực tiếp (Cut)"}</span>
                    </label>

                    {editingIsElimination && (
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-amber-700 dark:text-amber-400 select-none ml-4.5 animate-fadeIn">
                        <input
                          type="checkbox"
                          checked={editingIsSolo}
                          onChange={(e) => setEditingIsSolo(e.target.checked)}
                          className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span>{language === "en" ? "Generate SOLO round on tie break" : "Phát sinh vòng SOLO khi bằng điểm"}</span>
                      </label>
                    )}
                  </div>

                  {editingIsElimination && (
                    <div className="pl-4.5 border-l-2 border-indigo-200 flex flex-col gap-1.5 animate-slideDown">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-gray-500">{language === "en" ? "Determine advance by:" : "Lấy người đi tiếp bằng:"}</span>
                        <select
                          value={editingEliminationType}
                          onChange={(e) => setEditingEliminationType(e.target.value as "count" | "percent")}
                          className="bg-white dark:bg-slate-900 border rounded text-[11px] p-0.5 focus:outline-none"
                        >
                          <option value="percent">{language === "en" ? "% percentage to advance" : "% Số người đi tiếp"}</option>
                          <option value="count">{language === "en" ? "Specific number of people" : "Số người cụ thể"}</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-gray-500">{language === "en" ? "Advance value:" : "Giá trị đi tiếp:"}</span>
                        <input
                          type="number"
                          min={1}
                          value={editingEliminationValue}
                          onChange={(e) => setEditingEliminationValue(Math.max(1, Number(e.target.value)))}
                          className="w-14 p-0.5 bg-white dark:bg-slate-900 border rounded text-[11px] text-center font-mono focus:outline-none"
                        />
                        <span className="text-gray-405">
                          {editingEliminationType === "percent" ? "%" : (language === "en" ? "athletes" : "người")}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 justify-end mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!editingDistanceStr.trim()) return;
                        const isIndiv = editingDistanceType === "individual";
                        if (isIndiv) {
                          const updated = distances.map((d) => {
                            if (d.id === editingDistanceId) {
                              return {
                                ...d,
                                distance: editingDistanceStr.trim(),
                                multiplier: editingMultiplierVal,
                                isCumulative: editingIsCumulative,
                                isElimination: editingIsElimination,
                                eliminationType: editingEliminationType,
                                eliminationValue: editingIsElimination ? (editingEliminationValue || 50) : undefined,
                                isSolo: editingIsElimination ? editingIsSolo : false,
                                isMaxRoundScore: editingIsMaxRoundScore,
                              };
                            }
                            return d;
                          });
                          setDistances(updated);
                        } else {
                          const updated = teamDistances.map((d) => {
                            if (d.id === editingDistanceId) {
                              return {
                                ...d,
                                distance: editingDistanceStr.trim(),
                                multiplier: editingMultiplierVal,
                                isCumulative: editingIsCumulative,
                                isElimination: editingIsElimination,
                                eliminationType: editingEliminationType,
                                eliminationValue: editingIsElimination ? (editingEliminationValue || 50) : undefined,
                                isSolo: editingIsElimination ? editingIsSolo : false,
                                isMaxRoundScore: editingIsMaxRoundScore,
                              };
                            }
                            return d;
                          });
                          setTeamDistances(updated);
                        }
                        setEditingDistanceId(null);
                        setEditingDistanceType(null);
                      }}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold cursor-pointer"
                    >
                      {language === "en" ? "Save" : "Lưu"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDistanceId(null);
                        setEditingDistanceType(null);
                      }}
                      className="px-2.5 py-1 bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded text-xs font-semibold cursor-pointer"
                    >
                      {language === "en" ? "Cancel" : "Hủy"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center w-full">
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-850 dark:text-gray-200 flex items-center gap-1.5 flex-wrap">
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] uppercase font-black px-1.5 py-0.5 rounded-md dark:bg-indigo-950/35 dark:text-indigo-350 dark:border-indigo-900">
                        {language === "en" ? "Round " : "Vòng "}{distIdx + 1}
                      </span>
                      <span>{dist.distance}</span>
                    </span>
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      <span className="text-[10px] px-1 bg-slate-100 dark:bg-slate-900 dark:text-slate-400 rounded text-slate-650 font-mono">
                        {language === "en" ? "Multiplier:" : "Hệ số:"} x{dist.multiplier}
                      </span>
                      {dist.isCumulative && (
                        <span className="text-[9px] px-1 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 font-extrabold rounded uppercase border border-green-250 shrink-0">
                          {language === "en" ? "cumulative" : "cộng dồn"}
                        </span>
                      )}
                      {dist.isElimination && (
                        <span className="text-[9px] px-1 bg-amber-50 dark:bg-amber-950/20 text-amber-705 dark:text-amber-400 font-extrabold rounded uppercase border border-amber-250 shrink-0">
                          {language === "en" ? "cut (" : "loại ("}{dist.eliminationValue}{dist.eliminationType === "percent" ? "%" : (language === "en" ? " athletes" : " người")})
                        </span>
                      )}
                      {dist.isElimination && dist.isSolo && (
                        <span className="text-[9px] px-1 bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 font-extrabold rounded uppercase border border-purple-200 shrink-0">
                          🎯 SOLO
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDistanceId(dist.id);
                        setEditingDistanceType("individual");
                        setEditingDistanceStr(dist.distance);
                        setEditingMultiplierVal(dist.multiplier);
                        setEditingIsCumulative(!!dist.isCumulative);
                        setEditingIsElimination(!!dist.isElimination);
                        setEditingEliminationType(dist.eliminationType || "percent");
                        setEditingEliminationValue(dist.eliminationValue || 50);
                        setEditingIsSolo(!!dist.isSolo);
                        setEditingIsMaxRoundScore(!!dist.isMaxRoundScore);
                      }}
                      className="p-1.5 text-blue-600 hover:text-white bg-blue-50 dark:bg-blue-950/15 dark:text-blue-405 hover:bg-blue-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      title={language === "en" ? "Edit distance" : "Sửa cự ly"}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDistanceError("");
                        setConfirmDeleteDistanceId(dist.id);
                        setConfirmDeleteDistanceType("individual");
                      }}
                      className="p-1.5 text-rose-500 hover:text-white bg-rose-50 dark:bg-rose-955/15 hover:bg-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      title={language === "en" ? "Delete distance" : "Xóa cự ly"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add individual distance form */}
        <div className="border-t border-gray-100 pt-3 flex flex-col gap-2.5">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            {language === "en" ? "Add new individual distance" : "Thêm cự ly cá nhân mới"}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-gray-400 block mb-0.5">{language === "en" ? "Distance name:" : "Tên cự ly:"}</span>
              <input
                type="text"
                placeholder={language === "en" ? "e.g. 15 Meters" : "e.g. 15 Met"}
                value={newDistanceStr}
                onChange={(e) => setNewDistanceStr(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-gray-50 dark:bg-slate-905 border border-gray-300 dark:border-slate-800 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block mb-0.5">{language === "en" ? "Multiplier:" : "Hệ số nhân:"}</span>
              <input
                type="number"
                value={newMultiplierVal}
                onChange={(e) => setNewMultiplierVal(Math.max(1, Number(e.target.value)))}
                className="w-full px-2 py-1 text-xs bg-gray-50 dark:bg-slate-905 border border-gray-300 dark:border-slate-800 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mt-0.5">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-650 dark:text-gray-350 select-none">
              <input
                type="checkbox"
                checked={newIsMaxRoundScore}
                onChange={(e) => setNewIsMaxRoundScore(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{language === "en" ? "MAX points of rounds" : "Max điểm các vòng"}</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-650 dark:text-gray-350 select-none">
              <input
                type="checkbox"
                checked={newIsCumulative}
                onChange={(e) => setNewIsCumulative(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{language === "en" ? "Cumulative points from previous round" : "Cộng dồn điểm từ vòng trước"}</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-650 dark:text-gray-350 select-none">
              <input
                type="checkbox"
                checked={newIsElimination}
                onChange={(e) => setNewIsElimination(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{language === "en" ? "Apply direct elimination (Cut)" : "Áp dụng loại trực tiếp (Cut)"}</span>
            </label>

            {newIsElimination && (
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-amber-700 dark:text-amber-400 select-none ml-4.5 animate-fadeIn">
                <input
                  type="checkbox"
                  checked={newIsSolo}
                  onChange={(e) => setNewIsSolo(e.target.checked)}
                  className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                <span>{language === "en" ? "Generate SOLO round on tie break" : "Phát sinh vòng SOLO khi bằng điểm"}</span>
              </label>
            )}
          </div>

          {newIsElimination && (
            <div className="pl-4.5 border-l-2 border-blue-200 flex flex-col gap-1.5 animate-slideDown">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-500 font-medium">{language === "en" ? "Determine advance by:" : "Lấy người đi tiếp bằng:"}</span>
                <select
                  value={newEliminationType}
                  onChange={(e) => setNewEliminationType(e.target.value as "count" | "percent")}
                  className="bg-gray-50 dark:bg-slate-900 border rounded text-[11px] p-0.5"
                >
                  <option value="percent">{language === "en" ? "% percentage to advance" : "% Số người đi tiếp"}</option>
                  <option value="count">{language === "en" ? "Specific number of people" : "Số người cụ thể"}</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-500 font-medium">{language === "en" ? "Advance value:" : "Giá trị đi tiếp:"}</span>
                <input
                  type="number"
                  min={1}
                  value={newEliminationValue}
                  onChange={(e) => setNewEliminationValue(Math.max(1, Number(e.target.value)))}
                  className="w-14 p-0.5 bg-gray-55 dark:bg-slate-900 border rounded text-[11px] text-center font-mono"
                />
                <span className="text-gray-400 font-semibold">
                  {newEliminationType === "percent" ? "%" : (language === "en" ? "athletes" : "người")}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={handleAddDistance}
            className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> {language === "en" ? "Add Individual Distance" : "Thêm Cự Ly Cá Nhân"}
          </button>
        </div>
      </div>
      )}

      {/* 3. New Team Distance & Scopes Management (Placed to the right as requested) */}
      {tournamentType !== "individual" && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col gap-4">
        <h3 className="text-base font-bold text-gray-950 dark:text-white flex items-center gap-2 border-b pb-2 mb-1 uppercase tracking-wide">
          <Users className="w-4.5 h-4.5 text-blue-600" />
          {language === "en" ? "Team Distance" : "Cự Ly Đồng Đội"}
        </h3>

        {/* List of team distances */}
        <div className="flex-1 flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1">
          {teamDistances.map((dist, distIdx) => (
            <div 
              key={dist.id} 
              className="flex flex-col gap-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-850 rounded p-3 text-sm transition-all"
            >
              {editingDistanceId === dist.id && editingDistanceType === "team" ? (
                <div className="flex flex-col gap-2.5 animate-fadeIn w-full">
                  <div className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                    ✏️ {language === "en" ? `Edit Team Distance (Round ${distIdx + 1})` : `Sửa Cự Ly Đồng Đội (Vòng ${distIdx + 1})`}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-gray-400 block mb-0.5">{language === "en" ? "Distance name:" : "Tên cự ly:"}</span>
                      <input
                        type="text"
                        value={editingDistanceStr}
                        onChange={(e) => setEditingDistanceStr(e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-705 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block mb-0.5">{language === "en" ? "Multiplier:" : "Điểm nhân:"}</span>
                      <input
                        type="number"
                        value={editingMultiplierVal}
                        onChange={(e) => setEditingMultiplierVal(Math.max(1, Number(e.target.value)))}
                        className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-705 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 mt-0.5">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-650 dark:text-gray-350 select-none">
                      <input
                        type="checkbox"
                        checked={editingIsMaxRoundScore}
                        onChange={(e) => setEditingIsMaxRoundScore(e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{language === "en" ? "MAX points of rounds" : "Max điểm các vòng"}</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-650 dark:text-gray-350 select-none">
                      <input
                        type="checkbox"
                        checked={editingIsCumulative}
                        onChange={(e) => setEditingIsCumulative(e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{language === "en" ? "Cumulative points from previous round" : "Cộng dồn điểm từ vòng trước"}</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-650 dark:text-gray-350 select-none">
                      <input
                        type="checkbox"
                        checked={editingIsElimination}
                        onChange={(e) => setEditingIsElimination(e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{language === "en" ? "Apply direct elimination (Cut)" : "Áp dụng loại trực tiếp (Cut)"}</span>
                    </label>

                    {editingIsElimination && (
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-amber-700 dark:text-amber-405 select-none ml-4.5 animate-fadeIn">
                        <input
                          type="checkbox"
                          checked={editingIsSolo}
                          onChange={(e) => setEditingIsSolo(e.target.checked)}
                          className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span>{language === "en" ? "Generate SOLO round on tie break" : "Phát sinh vòng SOLO khi bằng điểm"}</span>
                      </label>
                    )}
                  </div>

                  {editingIsElimination && (
                    <div className="pl-4.5 border-l-2 border-indigo-200 flex flex-col gap-1.5 animate-slideDown">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-gray-500 font-semibold">{language === "en" ? "Determine advance by:" : "Lấy đội đi tiếp bằng:"}</span>
                        <select
                          value={editingEliminationType}
                          onChange={(e) => setEditingEliminationType(e.target.value as "count" | "percent")}
                          className="bg-white dark:bg-slate-900 border rounded text-[11px] p-0.5"
                        >
                          <option value="percent">{language === "en" ? "% percentage to advance" : "% Số đội đi tiếp"}</option>
                          <option value="count">{language === "en" ? "Specific number of teams" : "Số đội cụ thể"}</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-gray-500 font-semibold">{language === "en" ? "Advance value:" : "Giá trị đi tiếp:"}</span>
                        <input
                          type="number"
                          min={1}
                          value={editingEliminationValue}
                          onChange={(e) => setEditingEliminationValue(Math.max(1, Number(e.target.value)))}
                          className="w-14 p-0.5 bg-white dark:bg-slate-900 border rounded text-[11px] text-center font-mono"
                        />
                        <span className="text-gray-400 font-semibold">
                          {editingEliminationType === "percent" ? "%" : (language === "en" ? "teams" : "đội")}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 justify-end mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!editingDistanceStr.trim()) return;
                        const isIndiv = editingDistanceType === "individual";
                        if (isIndiv) {
                          const updated = distances.map((d) => {
                            if (d.id === editingDistanceId) {
                              return {
                                ...d,
                                distance: editingDistanceStr.trim(),
                                multiplier: editingMultiplierVal,
                                isCumulative: editingIsCumulative,
                                isElimination: editingIsElimination,
                                eliminationType: editingEliminationType,
                                eliminationValue: editingIsElimination ? (editingEliminationValue || 50) : undefined,
                                isSolo: editingIsElimination ? editingIsSolo : false,
                                isMaxRoundScore: editingIsMaxRoundScore,
                              };
                            }
                            return d;
                          });
                          setDistances(updated);
                        } else {
                          const updated = teamDistances.map((d) => {
                            if (d.id === editingDistanceId) {
                              return {
                                ...d,
                                distance: editingDistanceStr.trim(),
                                multiplier: editingMultiplierVal,
                                isCumulative: editingIsCumulative,
                                isElimination: editingIsElimination,
                                eliminationType: editingEliminationType,
                                eliminationValue: editingIsElimination ? (editingEliminationValue || 50) : undefined,
                                isSolo: editingIsElimination ? editingIsSolo : false,
                                isMaxRoundScore: editingIsMaxRoundScore,
                              };
                            }
                            return d;
                          });
                          setTeamDistances(updated);
                        }
                        setEditingDistanceId(null);
                        setEditingDistanceType(null);
                      }}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold cursor-pointer"
                    >
                      {language === "en" ? "Save" : "Lưu"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDistanceId(null);
                        setEditingDistanceType(null);
                      }}
                      className="px-2.5 py-1 bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded text-xs font-semibold cursor-pointer"
                    >
                      {language === "en" ? "Cancel" : "Hủy"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center w-full">
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-850 dark:text-gray-200 flex items-center gap-1.5 flex-wrap">
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] uppercase font-black px-1.5 py-0.5 rounded-md dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900">
                        {language === "en" ? "Round " : "Vòng "}{distIdx + 1}
                      </span>
                      <span>{dist.distance}</span>
                    </span>
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      <span className="text-[10px] px-1 bg-slate-100 dark:bg-slate-900 dark:text-slate-400 rounded text-slate-650 font-mono">
                        {language === "en" ? "Multiplier:" : "Hệ số:"} x{dist.multiplier}
                      </span>
                      {dist.isCumulative && (
                        <span className="text-[9px] px-1 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 font-extrabold rounded uppercase border border-green-250 shrink-0">
                          {language === "en" ? "cumulative" : "cộng dồn"}
                        </span>
                      )}
                      {dist.isElimination && (
                        <span className="text-[9px] px-1 bg-amber-50 dark:bg-amber-950/20 text-amber-705 dark:text-amber-400 font-extrabold rounded uppercase border border-amber-250 shrink-0">
                          {language === "en" ? "cut (" : "loại ("}{dist.eliminationValue}{dist.eliminationType === "percent" ? "%" : (language === "en" ? " teams" : " đội")})
                        </span>
                      )}
                      {dist.isElimination && dist.isSolo && (
                        <span className="text-[9px] px-1 bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 font-extrabold rounded uppercase border border-purple-200 shrink-0 animate-pulse">
                          🎯 SOLO
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDistanceId(dist.id);
                        setEditingDistanceType("team");
                        setEditingDistanceStr(dist.distance);
                        setEditingMultiplierVal(dist.multiplier);
                        setEditingIsCumulative(!!dist.isCumulative);
                        setEditingIsElimination(!!dist.isElimination);
                        setEditingEliminationType(dist.eliminationType || "percent");
                        setEditingEliminationValue(dist.eliminationValue || 50);
                        setEditingIsSolo(!!dist.isSolo);
                        setEditingIsMaxRoundScore(!!dist.isMaxRoundScore);
                      }}
                      className="p-1.5 text-blue-600 hover:text-white bg-blue-50 dark:bg-blue-95/15 dark:text-blue-405 hover:bg-blue-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      title={language === "en" ? "Edit distance" : "Sửa cự ly"}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDistanceError("");
                        setConfirmDeleteDistanceId(dist.id);
                        setConfirmDeleteDistanceType("team");
                      }}
                      className="p-1.5 text-rose-500 hover:text-white bg-rose-50 dark:bg-rose-955/15 hover:bg-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                      title={language === "en" ? "Delete distance" : "Xóa cự ly"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add team distance form */}
        <div className="border-t border-gray-100 pt-3 flex flex-col gap-2.5">
          <div className="text-xs font-black text-gray-500 uppercase tracking-widest">
            {language === "en" ? "Add new team distance" : "Thêm cự ly đồng đội mới"}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-gray-400 block mb-0.5">{language === "en" ? "Distance name:" : "Tên cự ly:"}</span>
              <input
                type="text"
                placeholder={language === "en" ? "e.g. 15 Meters Team" : "e.g. 15 Met Đồng Đội"}
                value={newTeamDistanceStr}
                onChange={(e) => setNewTeamDistanceStr(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-gray-55 dark:bg-slate-905 border border-gray-300 dark:border-slate-800 rounded"
              />
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block mb-0.5">{language === "en" ? "Multiplier:" : "Hệ số nhân:"}</span>
              <input
                type="number"
                value={newTeamMultiplierVal}
                onChange={(e) => setNewTeamMultiplierVal(Math.max(1, Number(e.target.value)))}
                className="w-full px-2 py-1 text-xs bg-gray-55 dark:bg-slate-905 border border-gray-300 dark:border-slate-800 rounded font-mono"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mt-0.5">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-650 dark:text-gray-350 select-none">
              <input
                type="checkbox"
                checked={newTeamIsMaxRoundScore}
                onChange={(e) => setNewTeamIsMaxRoundScore(e.target.checked)}
                className="rounded border-gray-350 text-blue-600"
              />
              <span>{language === "en" ? "MAX points of rounds" : "Max điểm các vòng"}</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-650 dark:text-gray-350 select-none">
              <input
                type="checkbox"
                checked={newTeamIsCumulative}
                onChange={(e) => setNewTeamIsCumulative(e.target.checked)}
                className="rounded border-gray-350 text-blue-600"
              />
              <span>{language === "en" ? "Cumulative points from previous round" : "Cộng dồn điểm từ vòng trước"}</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-650 dark:text-gray-350 select-none">
              <input
                type="checkbox"
                checked={newTeamIsElimination}
                onChange={(e) => setNewTeamIsElimination(e.target.checked)}
                className="rounded border-gray-350 text-blue-600"
              />
              <span>{language === "en" ? "Apply direct elimination (Cut)" : "Áp dụng loại trực tiếp (Cut)"}</span>
            </label>

            {newTeamIsElimination && (
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-black text-amber-700 dark:text-amber-400 select-none ml-4.5 animate-fadeIn">
                <input
                  type="checkbox"
                  checked={newTeamIsSolo}
                  onChange={(e) => setNewTeamIsSolo(e.target.checked)}
                  className="rounded border-amber-300 text-amber-600"
                />
                <span>{language === "en" ? "Generate SOLO round on tie break" : "Phát sinh vòng SOLO khi bằng điểm"}</span>
              </label>
            )}
          </div>

          {newTeamIsElimination && (
            <div className="pl-4.5 border-l-2 border-blue-200 flex flex-col gap-1.5 animate-slideDown">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-500 font-semibold font-sans">{language === "en" ? "Determine advance by:" : "Lấy đội đi tiếp bằng:"}</span>
                <select
                  value={newTeamEliminationType}
                  onChange={(e) => setNewTeamEliminationType(e.target.value as "count" | "percent")}
                  className="bg-gray-50 dark:bg-slate-900 border rounded text-[11px] p-0.5"
                >
                  <option value="percent">{language === "en" ? "% percentage to advance" : "% Số đội đi tiếp"}</option>
                  <option value="count">{language === "en" ? "Specific number of teams" : "Số đội cụ thể"}</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-500 font-semibold font-sans">{language === "en" ? "Advance value:" : "Giá trị đi tiếp:"}</span>
                <input
                  type="number"
                  min={1}
                  value={newTeamEliminationValue}
                  onChange={(e) => setNewTeamEliminationValue(Math.max(1, Number(e.target.value)))}
                  className="w-14 p-0.5 bg-gray-55 dark:bg-slate-900 border rounded text-[11px] text-center font-mono"
                />
                <span className="text-gray-400 font-bold">
                  {newTeamEliminationType === "percent" ? "%" : (language === "en" ? "teams" : "đội")}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={handleAddTeamDistance}
            className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> {language === "en" ? "Add Team Distance" : "Thêm Cự Ly Đồng Đội"}
          </button>
        </div>
      </div>
      )}


      {isNewTournamentModalOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-scaleIn text-slate-800 dark:text-slate-100 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-150 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-950">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-rose-100 dark:bg-rose-955/45 text-rose-600 dark:text-rose-450 flex items-center justify-center font-black">
                  <Trophy className="w-5 h-5 animate-bounce-slow" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black uppercase text-slate-900 dark:text-white tracking-wide">
                    {language === "en" ? "Create New Tournament" : "Khởi Tạo Giải Đấu Mới"}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-extrabold uppercase">
                    {language === "en" ? "Set up information & system configuration" : "Thiết lập thông tin & cấu hình hệ thống"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsNewTournamentModalOpen(false);
                  if (!activeHistoryId && setActiveTab) {
                    setActiveTab("home");
                  }
                }}
                className="p-1.5 hover:bg-gray-250 dark:hover:bg-slate-850 rounded-lg text-gray-400 hover:text-gray-650 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* ID + Name section */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex justify-between items-center">
                    <span>{language === "en" ? "Tournament ID *" : "Mã ID Giải Đấu *"}</span>
                    <span className="text-[7px] bg-indigo-950 text-indigo-400 border border-indigo-900 px-1 py-0.2 rounded font-black font-mono">{language === "en" ? "AUTO" : "TỰ ĐỘNG"}</span>
                  </label>
                  <input
                    type="text"
                    value={modalTournamentId}
                    readOnly
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-955 border border-gray-200 dark:border-slate-850 rounded-xl text-slate-500 font-black font-mono text-xs cursor-not-allowed outline-none select-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black text-gray-555 uppercase tracking-widest mb-1">{language === "en" ? "Tournament Name *" : "Tên Giải Đấu *"}</label>
                  <input
                    type="text"
                    value={modalTournamentName}
                    onChange={(e) => setModalTournamentName(e.target.value)}
                    placeholder={language === "en" ? "e.g. Vietnam Slingshot Cup" : "e.g. Giải Slingshot Việt Nam Cup"}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-505 font-bold text-xs"
                  />
                </div>
              </div>

              {/* Match Dates in Modal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-550 uppercase tracking-widest mb-1">
                    {language === "en" ? "Start Date" : "Ngày Thi Đấu"}
                  </label>
                  <input
                    type="date"
                    value={modalStartDate}
                    onChange={(e) => setModalStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-505 font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-555 uppercase tracking-widest mb-1">
                    {language === "en" ? "End Date" : "Ngày Kết Thúc"}
                  </label>
                  <input
                    type="date"
                    value={modalEndDate}
                    onChange={(e) => setModalEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-505 font-bold text-xs"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                  {language === "en" ? "Description, Rules & Details" : "Diễn giải, Luật bắn & Chi tiết"}
                </label>
                <textarea
                  value={modalTournamentDesc}
                  onChange={(e) => setModalTournamentDesc(e.target.value)}
                  rows={3}
                  placeholder={language === "en" ? "Enter details about tournament rules, scoring specifications, prize structure, etc..." : "Nhập chi tiết về điều lệ thi đấu, quy cách chấm điểm, cơ cấu giải thưởng, v.v..."}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-xs leading-relaxed"
                />
              </div>

              {/* Lựa Chọn Tạo Giải / Cơ Chế Giải Đấu */}
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Cơ chế giải đấu *</label>
                <select
                  value={modalTournamentType}
                  onChange={(e) => setModalTournamentType(e.target.value as "individual" | "team" | "combined")}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-xs"
                >
                  <option value="individual">Cá Nhân (Chỉ hiển thị môi trường Cá Nhân)</option>
                  <option value="team">Đồng Đội (Chỉ hiển thị môi trường Đồng Đội)</option>
                  <option value="combined">Cá Nhân + Đồng Đội (Kết Hợp)</option>
                </select>
              </div>

              {/* Lane Capacity & Shots config */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-gray-150 dark:border-slate-800 space-y-3.5">
                <h4 className="text-[10px] font-black text-slate-550 uppercase tracking-wider border-b border-gray-155 dark:border-slate-800 pb-1.5">Quy cách kỹ thuật (Cột điểm / Lượt bắn)</h4>
                
                {/* Lane Capacity */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-extrabold text-gray-600 uppercase">Số VĐV / LANE (x) :</label>
                    <span className="text-xs font-black font-mono text-rose-600 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded">{modalLaneCapacity} vận động viên</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="50"
                    value={modalLaneCapacity}
                    onChange={(e) => setModalLaneCapacity(Number(e.target.value))}
                    className="w-full accent-rose-600 cursor-pointer h-1.5 bg-gray-200 dark:bg-slate-850 rounded-lg"
                  />
                  <span className="text-[9px] text-gray-500 font-semibold block mt-1">Khống chế số lượng bắn đồng thời trên mỗi hàng/bàn súng</span>
                </div>

                <div className={`grid grid-cols-1 ${
                  modalTournamentType === "combined" ? "sm:grid-cols-2" : "sm:grid-cols-1"
                } gap-4`}>
                  {/* Individual shots */}
                  {modalTournamentType !== "team" && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-extrabold text-gray-600 uppercase">Cá Nhân (Cột điểm) :</label>
                        <span className="text-xs font-black font-mono text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded">{modalShotsCount} lượt</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="30"
                        value={modalShotsCount}
                        onChange={(e) => setModalShotsCount(Number(e.target.value))}
                        className="w-full accent-blue-600 cursor-pointer h-1 bg-gray-200 dark:bg-slate-850"
                      />
                    </div>
                  )}

                  {/* Team shots */}
                  {modalTournamentType !== "individual" && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-extrabold text-gray-600 uppercase">Đồng Đội (Cột điểm) :</label>
                        <span className="text-xs font-black font-mono text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded">{modalTeamShotsCount} lượt</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="30"
                        value={modalTeamShotsCount}
                        onChange={(e) => setModalTeamShotsCount(Number(e.target.value))}
                        className="w-full accent-indigo-600 cursor-pointer h-1 bg-gray-200 dark:bg-slate-850"
                      />
                    </div>
                  )}
                </div>
              </div>

              {tournamentError && (
                <div className="p-3 bg-red-50 dark:bg-red-955/20 border border-red-200 dark:border-red-900 rounded-xl text-xs font-bold text-red-650 dark:text-red-400 flex items-center gap-2">
                  <span>⚠️</span> {tournamentError}
                </div>
              )}

              <div className="bg-rose-50/50 dark:bg-rose-950/10 p-3.5 rounded-xl border border-rose-150/40 dark:border-rose-900/30 text-[11px] leading-relaxed text-indigo-800 dark:text-indigo-455 font-semibold shadow-sm">
                🚨 <span className="uppercase text-rose-600 font-extrabold">Cực kỳ lưu ý:</span> Khi đồng ý tạo mới, toàn bộ điểm hiện tại và danh sách vận động viên của giải hiện hành sẽ được Reset về trống. Toàn bộ thông tin cấu hình này sẽ tự động KHÓA LẠI để tránh vô tình chạm nhầm trong suốt quá trình ghi điểm giải đấu!
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-150 dark:border-slate-800/80 flex justify-end gap-3 bg-gray-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => {
                  setIsNewTournamentModalOpen(false);
                  if (!activeHistoryId && setActiveTab) {
                    setActiveTab("home");
                  }
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-705 text-slate-700 dark:text-white rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!modalTournamentId.trim()) {
                    setTournamentError("Vui lòng nhập Mã ID cho giải!");
                    return;
                  }
                  if (!modalTournamentName.trim()) {
                    setTournamentError("Vui lòng nhập Tên cho giải!");
                    return;
                  }

                  const currentUser = auth.currentUser;
                  if (!currentUser) {
                    setTournamentError("Bạn cần đăng nhập trước để khởi tạo giải đấu trực tuyến!");
                    return;
                  }

                  try {
                    setTournamentError("");
                    
                    const defaultDistances: DistanceConfig[] = (distances && distances.length > 0) ? distances : [
                      { id: "dist-1", distance: "10 Met", multiplier: 10 },
                      { id: "dist-2", distance: "15 Met", multiplier: 15 }
                    ];
                    const defaultTeamDistances: DistanceConfig[] = (teamDistances && teamDistances.length > 0) ? teamDistances : [
                      { id: "dist-1", distance: "10 Met", multiplier: 10 },
                      { id: "dist-2", distance: "15 Met", multiplier: 15 }
                    ];

                    const creatorEmail = currentUser.email || "";
                    const newTourId = await createOnlineTournament(
                      modalTournamentName.trim(),
                      currentUser.uid,
                      creatorEmail,
                      {
                        competitionMode: modalTournamentType === "team" ? "team" : "individual",
                        tournamentType: modalTournamentType,
                        shotsCount: modalShotsCount,
                        teamShotsCount: modalTeamShotsCount,
                        laneCapacity: modalLaneCapacity,
                        distances: defaultDistances,
                        teamDistances: defaultTeamDistances,
                        athletes: [],
                        teamAthletes: [],
                        inputAthletes: [],
                        teamInputAthletes: [],
                        masterAthletes: [],
                        clubs: []
                      }
                    );

                    if (setTournamentType) {
                      setTournamentType(modalTournamentType);
                      localStorage.setItem("slingshot_tournament_type", modalTournamentType);
                    }

                    // 1. Save current session to history if there's any active data (preserving 100% logic)
                    if (matchName && matchName.trim() && (athletes.length > 0 || masterAthletes.length > 0)) {
                      onSaveCurrentSessionToHistory(matchName);
                    }
                    const athletesToSave = masterAthletes.length > 0 ? masterAthletes : athletes;
                    if (matchName && matchName.trim() && athletesToSave.length > 0) {
                      const newSavedList: StoredAthleteList = {
                        id: `list-${Date.now()}`,
                        name: matchName.trim(),
                        createdAt: new Date().toISOString(),
                        athletes: JSON.parse(JSON.stringify(athletesToSave)),
                      };
                      setStoredAthleteLists((prev) => {
                        const filtered = prev.filter((item) => item.name.toLowerCase() !== matchName.toLowerCase());
                        return [newSavedList, ...filtered];
                      });
                    }

                    // 2. Update parent states
                    setMatchName(modalTournamentName.trim());
                    setAthletes([]);
                    setTeamAthletes([]);
                    setMasterAthletes([]);
                    setInputAthletes?.([]);
                    setTeamInputAthletes?.([]);
                    setStartDate(modalStartDate);
                    setEndDate(modalEndDate);
                    setAvatarUrl("");
                    setBannerUrl("");
                    localStorage.removeItem("slingshot_avatar_url");
                    localStorage.removeItem("slingshot_banner_url");

                    // Track creation time of new tournament to delay roster auto-save
                    localStorage.setItem("slingshot_new_tournament_created_at", Date.now().toString());

                    // Set active history ID to the newly created Cloud tournament
                    setActiveHistoryId(newTourId);

                    localStorage.setItem("slingshot_active_tournament_id", newTourId);
                    setTournamentId(modalTournamentId.trim());
                    
                    // Keep active sequence updated in localStorage
                    const seqNumParsed = Number(modalTournamentId.replace(/\D/g, "")) || 1;
                    localStorage.setItem("slingshot_active_tournament_seq", seqNumParsed.toString());

                    localStorage.setItem("slingshot_active_tournament_desc", modalTournamentDesc.trim());
                    setTournamentDesc(modalTournamentDesc.trim());

                    localStorage.setItem("slingshot_active_tournament_lane_capacity", modalLaneCapacity.toString());
                    setLaneCapacityValue(modalLaneCapacity);

                    localStorage.setItem("slingshot_active_tournament_is_locked", "true");
                    setIsTournamentLocked(true);

                    // 3. Set precision shots points count for individual & teams
                    handleShotsCountChange(modalShotsCount);
                    handleTeamShotsCountChange(modalTeamShotsCount);

                    // 4. Close dialog successfully
                    setIsNewTournamentModalOpen(false);
                  } catch (err: any) {
                    setTournamentError("Lỗi kết nối tạo giải: " + (err.message || err));
                  }
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-rose-500/25 cursor-pointer active:scale-98"
              >
                Đồng Ý Tạo Mới 🏆
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Session Reset Confirmation Modal */}
      {confirmReset && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fadeIn text-slate-800 dark:text-slate-101"
          onClick={() => setConfirmReset(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-sm w-full border border-slate-200 dark:border-slate-800 animate-scaleUp p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-amber-600 animate-bounce">
              <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-full">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-101 uppercase tracking-wide font-sans">Reset Toàn Bộ Điểm Số?</h3>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
              Bạn có chắc chắn muốn khôi phục toàn bộ bảng điểm cá nhân & đồng đội hiện tại về trống? Toàn bộ điểm số đã ghi sẽ bị xóa sạch khỏi giải đấu hiện hành.
            </p>

            <div className="flex gap-2 justify-end font-sans mt-1">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetSession();
                  setConfirmReset(false);
                }}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-705 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
              >
                Xác nhận Reset
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Distance Deletion Confirmation Modal */}
      {confirmDeleteDistanceId && distanceToDelete && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] text-slate-800 dark:text-slate-100"
          onClick={() => {
            setConfirmDeleteDistanceId(null);
            setConfirmDeleteDistanceType(null);
          }}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-sm w-full border border-slate-200 dark:border-slate-800 animate-scaleUp p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-50 dark:bg-rose-955/30 rounded-full">
                <Trash2 className="w-5 h-5 animate-pulse" />
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-101 uppercase tracking-wide font-sans">Xóa Cự Ly Bắn?</h3>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
              Bạn có chắc muốn xóa cự ly <strong>{distanceToDelete.distance}</strong> ({confirmDeleteDistanceType === "individual" ? "Cá nhân" : "Đồng đội"})? Điều này sẽ xóa mọi bản ghi điểm của toàn bộ VĐV thuộc cự ly này.
            </p>

            <div className="flex gap-2 justify-end font-sans mt-1">
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteDistanceId(null);
                  setConfirmDeleteDistanceType(null);
                }}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmDeleteDistanceType === "individual") {
                    if (distances.length <= 1) {
                      setDistanceError("Bắt buộc giữ tối thiểu 1 cự ly bắn cá nhân!");
                      setConfirmDeleteDistanceId(null);
                      setConfirmDeleteDistanceType(null);
                      return;
                    }
                    setDistanceError("");
                    const updatedDistances = distances.filter((d) => d.id !== confirmDeleteDistanceId);
                    setDistances(updatedDistances);

                    const updatedAthletes = athletes.map((athlete) => {
                      const newScores = { ...athlete.scores };
                      delete newScores[confirmDeleteDistanceId];
                      return { ...athlete, scores: newScores };
                    });
                    setAthletes(updatedAthletes);
                  } else {
                    if (teamDistances.length <= 1) {
                      setDistanceError("Bắt buộc giữ tối thiểu 1 cự ly bắn đồng đội!");
                      setConfirmDeleteDistanceId(null);
                      setConfirmDeleteDistanceType(null);
                      return;
                    }
                    setDistanceError("");
                    const updatedDistances = teamDistances.filter((d) => d.id !== confirmDeleteDistanceId);
                    setTeamDistances(updatedDistances);

                    const updatedAthletes = teamAthletes.map((athlete) => {
                      const newScores = { ...athlete.scores };
                      delete newScores[confirmDeleteDistanceId];
                      return { ...athlete, scores: newScores };
                    });
                    setTeamAthletes(updatedAthletes);
                  }
                  setConfirmDeleteDistanceId(null);
                  setConfirmDeleteDistanceType(null);
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
              >
                Đồng ý xóa
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Configuration Lock Confirmation Modal */}
      {isConfirmLockModalOpen && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] text-slate-800 dark:text-slate-100"
          onClick={() => setIsConfirmLockModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-800 animate-scaleUp p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-indigo-600">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-full">
                <AlertTriangle className="w-5 h-5 text-indigo-600 animate-pulse" />
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-101 uppercase tracking-wide font-sans">
                Xác Nhận Thay Đổi Cấu Hình?
              </h3>
            </div>
            
            <div className="text-xs text-slate-500 dark:text-slate-400 font-sans leading-relaxed">
              <p className="mb-2">Bạn đang yêu cầu khóa cấu hình giải đấu. Các thay đổi chi tiết sau sẽ được áp dụng chính thức:</p>
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                {lockPendingChanges.map((change, idx) => (
                  <div key={idx} className="flex gap-1.5 items-start">
                    <span className="text-indigo-500 select-none">✦</span>
                    <span>{change}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end font-sans mt-2">
              <button
                type="button"
                onClick={() => setIsConfirmLockModalOpen(false)}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  const currentName = tempMatchName.trim();
                  if (currentName && currentName !== snapshotMatchName) {
                    handleSaveMatchName();
                  }
                  setIsTournamentLocked(true);
                  localStorage.setItem("slingshot_active_tournament_is_locked", "true");
                  setIsConfirmLockModalOpen(false);
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
              >
                Xác nhận thay đổi
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
