import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../context/LanguageContext";
import { MatchHistoryItem } from "../types";
import { Calendar, Trash2, RotateCcw, Award, FileSpreadsheet, Trophy, Users, FileDown, FileUp, Database, Clock, ShieldAlert, HardDriveDownload } from "lucide-react";
import { getHitCount } from "../utils/qualification";

interface HistoryPanelProps {
  history: MatchHistoryItem[];
  onRestoreHistoryItem: (itemId: string) => void;
  onDeleteHistoryItem: (itemId: string) => void;
  currentMasterCount?: number;
  onExportBackup: () => void;
  onImportBackup: (data: string) => boolean;
  userRole?: string;
  onRestoreDeviceBackup?: (backupId: string) => boolean;
  onDeleteDeviceBackup?: (backupId: string) => boolean;
  matchName?: string;
  onSaveCurrentSessionToHistory?: (customName?: string) => void;
  startDate?: string;
  endDate?: string;
  onUpdateHistory?: React.Dispatch<React.SetStateAction<MatchHistoryItem[]>>;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  onRestoreHistoryItem,
  onDeleteHistoryItem,
  currentMasterCount = 0,
  onExportBackup,
  onImportBackup,
  userRole = "spectator",
  onRestoreDeviceBackup,
  onDeleteDeviceBackup,
  matchName = "",
  onSaveCurrentSessionToHistory,
  startDate = "",
  endDate = "",
  onUpdateHistory,
}) => {
  const { language } = useLanguage();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState(false);
  const [sessionSaveName, setSessionSaveName] = useState("");

  // Custom states for Selection Export and Multiple Files Import
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportIds, setSelectedExportIds] = useState<string[]>([]);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFilesPending, setImportFilesPending] = useState<{
    fileName: string;
    tournaments: MatchHistoryItem[];
    error?: string;
  }[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const fileInputRefFull = useRef<HTMLInputElement>(null);
  const fileInputRefRestore = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  const [deviceBackups, setDeviceBackups] = useState<{ id: string; timestamp: number; matchName: string; isTimeline: boolean }[]>([]);

  const getTournamentStatus = (startDateStr?: string, endDateStr?: string): "active" | "upcoming" | "ended" => {
    if (!startDateStr) return "active";
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const partsStart = startDateStr.split("-");
    if (partsStart.length !== 3) return "active";
    const start = new Date(Number(partsStart[0]), Number(partsStart[1]) - 1, Number(partsStart[2]));
    
    if (today < start) {
      return "upcoming";
    }
    
    if (endDateStr) {
      const partsEnd = endDateStr.split("-");
      if (partsEnd.length === 3) {
        const end = new Date(Number(partsEnd[0]), Number(partsEnd[1]) - 1, Number(partsEnd[2]), 23, 59, 59, 999);
        if (now > end) {
          return "ended";
        }
      }
    }
    return "active";
  };

  const currentStatus = getTournamentStatus(startDate, endDate);

  const loadDeviceBackups = () => {
    try {
      const savedIndex = localStorage.getItem("vsc_device_backups_index");
      if (savedIndex) {
        setDeviceBackups(JSON.parse(savedIndex));
      } else {
        setDeviceBackups([]);
      }
    } catch {
      setDeviceBackups([]);
    }
  };

  useEffect(() => {
    loadDeviceBackups();

    const handleUpdate = () => {
      loadDeviceBackups();
    };

    window.addEventListener("vsc_backups_updated", handleUpdate);
    return () => {
      window.removeEventListener("vsc_backups_updated", handleUpdate);
    };
  }, []);


  const [deviceBackupRestoreId, setDeviceBackupRestoreId] = useState<string | null>(null);

  // Format date readable
  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const formatTimeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return language === "en" ? "Just now" : "Vừa mới đây";
    if (mins < 60) return language === "en" ? `${mins}m ago` : `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return language === "en" ? `${hours}h ago` : `${hours} giờ trước`;
    return formatDate(new Date(ts).toISOString());
  };

  // Open download selector modal with all checked by default
  const handleOpenExportModal = () => {
    setSelectedExportIds(history.map(h => h.id));
    setIsExportModalOpen(true);
  };

  // Download selected backups under a common JSON container
  const handleDownloadSelectedBackups = () => {
    const selectedTournaments = history.filter(h => selectedExportIds.includes(h.id));
    if (selectedTournaments.length === 0) return;

    const backupData = {
      type: "vscs_tournaments_backup",
      history: selectedTournaments,
    };
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `slingshot-tournaments-backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsExportModalOpen(false);
  };

  // Process a list of uploaded/selected backup files
  const handleProcessFiles = (files: FileList) => {
    const promises = Array.from(files).map(file => {
      return new Promise<{ fileName: string; tournaments: MatchHistoryItem[]; error?: string }>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const text = e.target?.result as string;
            const parsed = JSON.parse(text);
            let tournaments: MatchHistoryItem[] = [];

            if (Array.isArray(parsed)) {
              tournaments = parsed.filter(item => item && item.matchName && Array.isArray(item.athletes));
            } else if (typeof parsed === "object" && parsed !== null) {
              if (Array.isArray(parsed.history)) {
                tournaments = parsed.history.filter((item: any) => item && item.matchName && Array.isArray(item.athletes));
              } else if (parsed.matchName && Array.isArray(parsed.athletes)) {
                tournaments = [{
                  id: parsed.id || `hist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                  date: parsed.date || new Date().toISOString(),
                  matchName: parsed.matchName,
                  shotCount: parsed.shotCount || parsed.shotsCount || 5,
                  distances: parsed.distances || [],
                  athletes: parsed.athletes || [],
                  masterCount: parsed.masterCount || (parsed.athletes ? parsed.athletes.length : 0),
                  masterAthletes: parsed.masterAthletes || parsed.athletes || [],
                  teamDistances: parsed.teamDistances || [],
                  teamShotCount: parsed.teamShotCount || parsed.teamShotsCount || 5,
                  teamAthletes: parsed.teamAthletes || [],
                  startDate: parsed.startDate || "",
                  endDate: parsed.endDate || "",
                  clubs: parsed.clubs || []
                }];
              }
            }

            if (tournaments.length === 0) {
              resolve({
                fileName: file.name,
                tournaments: [],
                error: language === "en" ? "No valid tournament data found!" : "Không tìm thấy dữ liệu giải đấu hợp lệ!",
              });
            } else {
              resolve({ fileName: file.name, tournaments });
            }
          } catch {
            resolve({
              fileName: file.name,
              tournaments: [],
              error: language === "en" ? "Invalid JSON file structure!" : "Cấu trúc file JSON không hợp lệ!",
            });
          }
        };
        reader.onerror = () => {
          resolve({
            fileName: file.name,
            tournaments: [],
            error: language === "en" ? "Error reading file!" : "Lỗi khi đọc file!",
          });
        };
        reader.readAsText(file);
      });
    });

    Promise.all(promises).then(results => {
      setImportFilesPending(results);
      setIsImportModalOpen(true);
    });
  };

  // Perform import/overwriting on history state in parent
  const handleExecuteRestore = () => {
    if (!onUpdateHistory) return;

    const validTournaments: MatchHistoryItem[] = [];
    importFilesPending.forEach(item => {
      if (!item.error) {
        validTournaments.push(...item.tournaments);
      }
    });

    if (validTournaments.length === 0) {
      setIsImportModalOpen(false);
      return;
    }

    onUpdateHistory(prevHistory => {
      const tempHistory = [...prevHistory];

      validTournaments.forEach(importedItem => {
        const collisionIdx = tempHistory.findIndex(
          h => h.matchName.trim().toLowerCase() === importedItem.matchName.trim().toLowerCase()
        );

        if (collisionIdx > -1) {
          // Overwrite existing keeping previous ID
          tempHistory[collisionIdx] = {
            ...importedItem,
            id: tempHistory[collisionIdx].id,
          };
        } else {
          // Add/Prepend new tournament
          tempHistory.unshift(importedItem);
        }
      });

      return tempHistory;
    });

    setIsImportModalOpen(false);
    setImportSuccess(true);
    setTimeout(() => setImportSuccess(false), 4500);
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Premium History-Specific Backup & Sync Bar */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-left">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-600" />
            {language === "en" ? "Backup & Restore Entire Tournament Data" : "Sao Lưu & Phục Hồi Dữ Liệu Toàn Bộ Giải Đấu"}
          </h3>
          <p className="text-[11px] text-gray-500 mt-1 max-w-xl">
            {language === "en" 
              ? "All history logs, distance settings, and athletes list will be fully packed into your JSON file." 
              : "Tất cả các bản ghi lịch sử, cấu hình cự ly, và danh sách vận động viên sẽ được đóng gói đầy đủ trong file JSON của bạn."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            onClick={handleOpenExportModal}
            className="flex-1 md:flex-none py-1.5 px-4 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-98"
          >
            <FileDown className="w-4.5 h-4.5" /> {language === "en" ? "Download Backup (.json)" : "Tải Sao Lưu (.json)"}
          </button>
          
          <button
            type="button"
            onClick={() => multiFileInputRef.current?.click()}
            className="flex-1 md:flex-none py-1.5 px-4 text-xs bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-xl font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center"
          >
            <FileUp className="w-4.5 h-4.5" /> {language === "en" ? "Restore from File (.json)" : "Phục Hồi Từ File (.json)"}
          </button>
          <input
            ref={multiFileInputRef}
            type="file"
            accept=".json"
            multiple
            onChange={(e) => {
              if (e.target.files) {
                handleProcessFiles(e.target.files);
              }
              e.target.value = "";
            }}
            className="hidden"
          />
        </div>
      </div>

      {importError && (
        <span className="text-[11px] text-red-650 font-bold block bg-red-50 p-3 rounded-xl border border-red-200 text-center animate-fadeIn">{importError}</span>
      )}
      {importSuccess && (
        <span className="text-[11px] text-emerald-700 font-extrabold block bg-emerald-50 p-3 rounded-xl border border-emerald-250 text-center animate-fadeIn animate-pulse">
          {language === "en" ? "✓ Successfully restored all history logs!" : "✓ Đã phục hồi toàn bộ dữ liệu lịch sử thành công!"}
        </span>
      )}

      {/* MANUAL HISTORY SAVE CARD */}
      {(userRole === "admin" || userRole === "subAdmin") && onSaveCurrentSessionToHistory && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-4.5 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="text-left">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Award className="w-4.5 h-4.5 text-emerald-600 animate-pulse" />
              {language === "en" ? "Record Current Tournament (Manual Backup)" : "Ghi Lịch Sử Giải Hiện Tại (Manual Backup)"}
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
              {language === "en" 
                ? "Manually archive the current state of scores into local storage history." 
                : "Lưu trữ thủ công toàn bộ trạng thái điểm số hiện tại của giải đấu vào kho lịch sử thiết bị hiện tại."}
            </p>
          </div>

          <div className="flex gap-2 w-full sm:w-auto items-center shrink-0">
            <input
              type="text"
              placeholder={matchName || (language === "en" ? "e.g. Qualification..." : "e.g. Vòng Sơ Loại...")}
              value={sessionSaveName}
              onChange={(e) => setSessionSaveName(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border dark:border-slate-800 border-gray-300 rounded-xl focus:outline-none w-full sm:w-56 font-bold text-slate-800 dark:text-slate-100"
            />
            <button
              onClick={() => {
                onSaveCurrentSessionToHistory(sessionSaveName || matchName);
                setSessionSaveName("");
              }}
              className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl cursor-pointer whitespace-nowrap transition-colors shadow-sm"
            >
              {language === "en" ? "Save Match" : "Ghi Lại Giải"}
            </button>
          </div>
        </div>
      )}

      {/* ADMIN & SUB-ADMIN AUTO-BACKUP HỘP ĐEN DASHBOARD */}
      {(userRole === "admin" || userRole === "subAdmin") && currentStatus === "active" && (
        <div className="bg-slate-900 border border-slate-800 text-white p-5 rounded-2xl shadow-lg relative overflow-hidden">
          {/* Subtle decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="bg-indigo-500/10 p-2 rounded-xl text-indigo-400 border border-indigo-500/20 shrink-0">
                <Database className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                  {language === "en" ? "BLACKBOX INTERNAL DEVICE BACKUPS" : "HỘP ĐEN SAO LƯU NỘI BỘ (DEVICE BACKUPS)"}
                  <span className="bg-rose-500 text-white text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded-full uppercase shrink-0 animate-pulse">
                    ADMIN & SUB-ADMIN
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {language === "en" 
                    ? "Autosave state to Organizer's device (Overwrite every 5 min, timeline point every 15 min - saves 5 recent copies)." 
                    : "Tự động lưu trạng thái xuống thiết bị của Ban Tổ Chức (Ghi đè mỗi 5 phút, tạo dòng thời gian mỗi 15 phút - lưu 5 bản gần nhất)."}
                </p>
              </div>
            </div>
          </div>

          {deviceBackups.length === 0 ? (
            <div className="bg-slate-950/40 p-5 rounded-xl border border-slate-800 text-center text-xs text-slate-400 font-medium">
              <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2 animate-spin" />
              {language === "en" ? "No automatic backups recorded from Admin's current scoring session yet." : "Chưa ghi nhận bản sao lưu tự động nào từ phiên chấm điểm hiện tại của Admin."}<br />
              <span className="text-[10px] text-slate-500">
                {language === "en" ? "Scheduled periodic sweep will overwrite and activate after 5 minutes of activity." : "Tiến trình tự động quét định kỳ sẽ ghi đè và kích hoạt sau 5 phút làm việc."}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {deviceBackups.map((b) => (
                <div 
                  key={b.id} 
                  className={`bg-slate-950/50 p-3.5 rounded-xl border ${
                    b.isTimeline 
                      ? "border-cyan-500/10 bg-gradient-to-br from-cyan-950/10 to-slate-950" 
                      : "border-amber-500/10 bg-gradient-to-br from-amber-950/10 to-slate-950"
                  } flex flex-col justify-between gap-3 text-xs`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mb-1.5 ${
                        b.isTimeline 
                          ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" 
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        <Clock className="w-3 h-3" />
                        {b.isTimeline 
                          ? (language === "en" ? "15 Min (Timeline)" : "15 Phút (Dòng thời gian)") 
                          : (language === "en" ? "5 Min (Overwrite)" : "5 Phút (Ghi đè liên tục)")}
                      </span>
                      <h4 className="text-sm font-black text-slate-100 line-clamp-1">
                        {b.matchName}
                      </h4>
                      <p className="text-[10px] text-slate-450 mt-0.5 font-mono">
                        {language === "en" ? "Saved: " : "Đã lưu: "}{formatTimeAgo(b.timestamp)} ({formatDate(new Date(b.timestamp).toISOString())})
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 border-t border-slate-800/80 pt-2.5 mt-1">
                    {deviceBackupRestoreId === b.id ? (
                      <div className="w-full bg-amber-950/30 border border-amber-500/30 p-2 rounded-lg flex flex-col gap-1.5 text-[11px] text-amber-300 animate-fadeIn font-extrabold items-center">
                        <span className="uppercase text-[9px] text-amber-400 tracking-wider flex items-center gap-1.5 text-center">
                          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-500 animate-pulse" />
                          {language === "en" ? "Overwrite current match on device?" : "Ghi đè giải hiện tại trên thiết bị?"}
                        </span>
                        <div className="flex gap-2 w-full">
                          <button
                            type="button"
                            onClick={() => {
                              onRestoreDeviceBackup?.(b.id);
                              setDeviceBackupRestoreId(null);
                            }}
                            className="flex-1 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-black cursor-pointer text-xs"
                          >
                            {language === "en" ? "Confirm Load" : "Xác nhận nạp"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeviceBackupRestoreId(null)}
                            className="py-1 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium cursor-pointer text-xs"
                          >
                            {language === "en" ? "Cancel" : "Hủy"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setDeviceBackupRestoreId(b.id)}
                          className="flex-1 py-1 px-3 bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 rounded-lg font-black transition-colors flex items-center justify-center gap-1 cursor-pointer text-[11px]"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> {language === "en" ? "Restore Match" : "Khôi phục giải"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(language === "en" ? `Are you sure you want to delete the internal backup of date ${formatDate(new Date(b.timestamp).toISOString())}?` : `Bạn chắc chắn muốn xóa bản sao lưu nội bộ ngày ${formatDate(new Date(b.timestamp).toISOString())}?`)) {
                              onDeleteDeviceBackup?.(b.id);
                            }
                          }}
                          className="py-1 px-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer border border-transparent hover:border-rose-500/20"
                          title={language === "en" ? "Delete backup" : "Xóa bản sao lưu"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* RECORD ARCHIVES HEADER */}
      <div className="border-b dark:border-slate-800 pb-2 mt-2">
        <h3 className="text-base font-black text-slate-850 dark:text-slate-150 uppercase tracking-wider flex items-center gap-2 font-sans">
          <Calendar className="w-4.5 h-4.5 text-blue-600" />
          {language === "en" ? "Tournament Records History" : "Hồ Sơ Lịch Sử Các Trận Đấu (Tournament Records)"}
        </h3>
        <p className="text-[11px] text-gray-500 mt-0.5">
          {language === "en" ? "List of tournaments manually archived in the current session." : "Danh sách các giải đấu được lưu trữ thủ công trong phiên hoạt động hiện tại."}
        </p>
        <div className="mt-2 text-[10px] text-amber-700 bg-amber-50 dark:bg-amber-950/25 px-3 py-1.5 rounded-xl border border-amber-200/40 inline-flex items-center gap-1.5 font-bold">
          <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          {language === "en" 
            ? "Auto-Cleanup: Backed-up records are automatically kept for 30 days and purged thereafter." 
            : "Tự động dọn dẹp: Các giải đấu sao lưu sẽ tự động xóa khỏi bộ nhớ trong vòng 30 ngày kể từ khi tạo giải."}
        </div>
      </div>

      {history.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm text-center flex flex-col gap-3 items-center justify-center">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-1" />
          <h3 className="text-base font-bold text-gray-700 dark:text-gray-200">{language === "en" ? "No archived history yet" : "Chưa có lịch sử lưu trữ"}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-455 max-w-sm mx-auto leading-relaxed font-sans">
            {language === "en" 
              ? "Your current scores will be automatically saved to your browser memory. To move an old tournament to the permanent archive, press the 'Save Match' button in the Tournament Settings section." 
              : "Điểm số hiện tại của bạn sẽ được tự động lưu vào bộ nhớ trình duyệt. Để chuyển hẳn một giải cũ vào kho lưu trữ vĩnh viễn, hãy nhấn nút \"Lưu lại giải\" ở phần Cấu hình giải đấu."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {history.map((item) => {
            // Calculate champion
            let championName = language === "en" ? "None yet" : "Chưa có";
            let championTeam = "";
            let maxScore = -1;

            item.athletes.forEach((athlete) => {
              let athleteScore = 0;
              item.distances.forEach((dist) => {
                const hits = athlete.scores[dist.id] || [];
                athleteScore += getHitCount(hits) * dist.multiplier;
              });

              if (athleteScore > maxScore) {
                maxScore = athleteScore;
                championName = athlete.name;
                championTeam = athlete.team;
              }
            });

            return (
              <div 
                key={item.id} 
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3 relative animate-fadeIn"
              >
                {/* Header info */}
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {formatDate(item.date)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeleteId(item.id);
                      }}
                      className="p-1.5 bg-rose-50 dark:bg-rose-955/20 text-rose-500 hover:text-white hover:bg-rose-600 rounded-lg transition-all cursor-pointer shadow-sm active:scale-95"
                      title={language === "en" ? "Delete record" : "Xóa bản ghi lịch sử"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h4 className="text-base font-bold text-gray-900 mt-2 line-clamp-1 dark:text-white">
                    {item.matchName}
                  </h4>
                </div>

                {/* Quick specifications breakdown */}
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-gray-100 dark:border-slate-800 text-xs">
                  <div className="text-center">
                    <span className="text-[10px] text-gray-455 block mb-0.5 uppercase font-semibold">{language === "en" ? "Distances" : "Cự ly"}</span>
                    <span className="font-semibold text-gray-700 dark:text-slate-200">{item.distances.length} {language === "en" ? "lines" : "dòng"}</span>
                  </div>
                  <div className="text-center border-x border-gray-100 dark:border-slate-800">
                    <span className="text-[10px] text-gray-455 block mb-0.5 uppercase font-semibold">{language === "en" ? "Shots count" : "Số lượt bắn"}</span>
                    <span className="font-semibold text-gray-700 dark:text-slate-200 font-mono">{item.shotCount} {language === "en" ? "shots" : "phát"}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] text-gray-455 block mb-0.5 uppercase font-semibold">{language === "en" ? "Athletes (Comp/Reg)" : "VĐV (Thi/ĐK)"}</span>
                    <span className="font-semibold text-gray-700 dark:text-slate-200 font-mono flex items-center justify-center gap-0.5" title="Số vận động viên trong bảng Ghi Điểm / Số vận động viên đăng ký trong giải đấu">
                      <Users className="w-3.5 h-3.5 text-gray-405" /> {item.athletes.length}/{item.masterCount || item.athletes.length}
                    </span>
                  </div>
                </div>

                {/* Champion showcase */}
                {maxScore >= 0 && (
                  <div className="bg-amber-50/50 dark:bg-amber-955/20 border border-amber-100/50 dark:border-amber-900/20 rounded-lg p-2.5 flex items-center gap-2.5">
                    <div className="bg-amber-100 dark:bg-amber-955 p-1.5 rounded-full text-amber-600 dark:text-amber-400 shrink-0">
                      <Trophy className="w-4 h-4" />
                    </div>
                    <div className="text-xs">
                      <span className="text-[10px] text-amber-800 dark:text-amber-455 font-bold uppercase tracking-wide block">{language === "en" ? "Champion (Leaderboard Top)" : "Nhà Vô Địch (Đầu bảng)"}</span>
                      <span className="font-bold text-gray-800 dark:text-slate-100">{championName}</span>{" "}
                      {championTeam && (
                        <span className="text-gray-500 dark:text-slate-400 font-medium">({championTeam})</span>
                      )}
                      <span className="text-amber-700 dark:text-amber-400 font-mono font-bold block">
                        {maxScore} {language === "en" ? "points" : "điểm"}
                      </span>
                    </div>
                  </div>
                )}

                {/* List distances tags */}
                <div className="flex flex-wrap gap-1 mt-1">
                  {item.distances.map((dist) => (
                    <span key={dist.id} className="text-[10px] bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono">
                      {dist.distance} (x{dist.multiplier})
                    </span>
                  ))}
                </div>

                {/* Restore and detail buttons */}
                <div className="mt-auto pt-2 flex gap-2">
                  {confirmRestoreId === item.id ? (
                    <div className="w-full bg-amber-50 dark:bg-amber-955 border border-amber-250 dark:border-amber-900/50 p-2 rounded-xl flex flex-col gap-1.5 text-xs text-amber-900 dark:text-amber-300 animate-fadeIn font-extrabold justify-center items-center">
                      <span className="uppercase text-[9px] text-amber-805 dark:text-amber-400 block text-center tracking-wide">
                        {language === "en" ? "⚠️ Overwrite current scores?" : "⚠️ Ghi đè điểm hiện tại?"}
                      </span>
                      <div className="flex gap-1.5 w-full">
                        <button
                          type="button"
                          onClick={() => {
                            onRestoreHistoryItem(item.id);
                            setConfirmRestoreId(null);
                          }}
                          className="flex-1 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-black text-[10.5px] cursor-pointer"
                        >
                          {language === "en" ? "Yes, switch table" : "Có, đổi bảng"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRestoreId(null)}
                          className="py-1 px-3 bg-gray-200 dark:bg-slate-800 text-slate-755 dark:text-slate-300 rounded font-bold text-[10.5px] cursor-pointer"
                        >
                          {language === "en" ? "Cancel" : "Hủy"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmRestoreId(item.id);
                      }}
                      className="w-full py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> {language === "en" ? "Restore this score table" : "Khôi phục bảng điểm này"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MATCH RECORD DELETION CONFIRMATION DIALOG */}
      {confirmDeleteId && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fadeIn text-slate-800 dark:text-slate-101"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-sm w-full border border-slate-200 dark:border-slate-800 animate-scaleUp p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-50 dark:bg-rose-955/30 rounded-full">
                <Trash2 className="w-5 h-5 animate-pulse" />
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-101 uppercase tracking-wide font-sans">
                {language === "en" ? "Delete Tournament?" : "Xóa Giải Đấu?"}
              </h3>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
              {language === "en" ? (
                <>Are you sure you want to delete the record of <strong>{history.find(h => h.id === confirmDeleteId)?.matchName || "this tournament"}</strong>? All archived athlete profiles and saved scores will be completely wiped out and cannot be restored.</>
              ) : (
                <>Bạn có chắc chắn muốn xóa bản ghi của giải đấu <strong>{history.find(h => h.id === confirmDeleteId)?.matchName || "này"}</strong>? Toàn bộ hồ sơ danh sách VĐV và điểm số đã lưu trữ sẽ bị xóa sạch hoàn toàn và không thể khôi phục.</>
              )}
            </p>

            <div className="flex gap-2 justify-end font-sans mt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                {language === "en" ? "Cancel" : "Hủy bỏ"}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteHistoryItem(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
              >
                {language === "en" ? "Confirm Delete" : "Đồng ý xóa"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* SELECTION BACKUP DOWNLOAD DIALOG */}
      {isExportModalOpen && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fadeIn text-slate-800 dark:text-slate-101"
          onClick={() => setIsExportModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 dark:border-slate-800 animate-scaleUp p-5 flex flex-col gap-4 max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-955/30 rounded-full">
                <FileDown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-101 uppercase tracking-wide font-sans">
                  {language === "en" ? "Select Tournaments to Backup" : "Chọn các giải cần sao lưu"}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {language === "en" ? "Select the tournaments you want to download as a JSON backup file." : "Chọn một hoặc nhiều giải đấu để đóng gói và tải về máy."}
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center border-b dark:border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => {
                  if (selectedExportIds.length === history.length) {
                    setSelectedExportIds([]);
                  } else {
                    setSelectedExportIds(history.map(h => h.id));
                  }
                }}
                className="text-[11px] font-black uppercase text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {selectedExportIds.length === history.length 
                  ? (language === "en" ? "Deselect All" : "Bỏ chọn tất cả") 
                  : (language === "en" ? "Select All" : "Chọn tất cả")}
              </button>
              <span className="text-[10px] font-mono font-bold text-slate-500">
                {language === "en" ? `Selected ${selectedExportIds.length}/${history.length}` : `Đã chọn ${selectedExportIds.length}/${history.length}`}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[45vh] pr-1 flex flex-col gap-2">
              {history.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  {language === "en" ? "No historical tournaments found." : "Không có giải đấu nào trong lịch sử."}
                </div>
              ) : (
                history.map((h) => {
                  const isChecked = selectedExportIds.includes(h.id);
                  return (
                    <label 
                      key={h.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isChecked 
                          ? "bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/40" 
                          : "bg-slate-50/50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedExportIds(selectedExportIds.filter(id => id !== h.id));
                          } else {
                            setSelectedExportIds([...selectedExportIds, h.id]);
                          }
                        }}
                        className="w-4 h-4 text-indigo-600 border-slate-300 dark:border-slate-700 rounded focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                      />
                      <div className="flex-1 text-left">
                        <span className="block text-xs font-bold text-slate-800 dark:text-slate-101 line-clamp-1">{h.matchName}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-semibold">
                          {formatDate(h.date)} • {h.athletes.length} {language === "en" ? "athletes" : "vận động viên"}
                        </span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex gap-2 justify-end font-sans mt-2 border-t dark:border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                {language === "en" ? "Close" : "Đóng lại"}
              </button>
              <button
                type="button"
                onClick={handleDownloadSelectedBackups}
                disabled={selectedExportIds.length === 0}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5"
              >
                <FileDown className="w-4 h-4" />
                {language === "en" ? "Download Selected" : "Tải các giải đã chọn"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MULTIPLE BACKUP FILES IMPORT & PREVIEW DIALOG */}
      {isImportModalOpen && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fadeIn text-slate-800 dark:text-slate-101"
          onClick={() => setIsImportModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 dark:border-slate-800 animate-scaleUp p-5 flex flex-col gap-4 max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
              <div className="p-2 bg-blue-50 dark:bg-blue-955/30 rounded-full">
                <FileUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-101 uppercase tracking-wide font-sans">
                  {language === "en" ? "Restore tournaments from files" : "Phục hồi giải đấu từ File"}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {language === "en" ? "Verify the imported tournaments below. Existing matches will be overwritten." : "Kiểm tra danh sách giải đấu từ file tải lên. Nếu trùng tên, hệ thống sẽ tự động ghi đè."}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[45vh] pr-1 flex flex-col gap-3">
              {importFilesPending.map((fileItem, idx) => (
                <div key={idx} className="bg-slate-50/60 dark:bg-slate-950/30 border border-slate-150 dark:border-slate-850 p-3 rounded-2xl flex flex-col gap-2">
                  <div className="flex justify-between items-center border-b dark:border-slate-800/80 pb-1.5">
                    <span className="text-[11px] font-black font-mono text-slate-600 dark:text-slate-400 truncate max-w-[280px]">📄 {fileItem.fileName}</span>
                    {fileItem.error ? (
                      <span className="text-[9px] font-black uppercase text-red-500 bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded border border-red-200/30">Lỗi</span>
                    ) : (
                      <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-200/30">
                        {fileItem.tournaments.length} {language === "en" ? "Matches" : "Giải đấu"}
                      </span>
                    )}
                  </div>

                  {fileItem.error ? (
                    <div className="text-[11px] text-red-500 font-bold p-1">
                      ⚠️ {fileItem.error}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 pl-1.5">
                      {fileItem.tournaments.map((t, tIdx) => {
                        const exists = history.some(h => h.matchName.trim().toLowerCase() === t.matchName.trim().toLowerCase());
                        return (
                          <div key={tIdx} className="flex justify-between items-center text-xs">
                            <div className="text-left flex-1 truncate pr-2">
                              <span className="font-extrabold text-slate-800 dark:text-slate-101 block truncate">{t.matchName}</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-medium">{t.athletes.length} {language === "en" ? "athletes" : "vận động viên"}</span>
                            </div>
                            {exists ? (
                              <span className="text-[9px] font-extrabold uppercase bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-200/20 shrink-0">
                                {language === "en" ? "Overwrite" : "Ghi đè"}
                              </span>
                            ) : (
                              <span className="text-[9px] font-extrabold uppercase bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded border border-blue-200/20 shrink-0">
                                {language === "en" ? "+ Add New" : "+ Thêm mới"}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-end font-sans mt-2 border-t dark:border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                {language === "en" ? "Cancel" : "Hủy bỏ"}
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={importFilesPending.every(f => f.error)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5"
              >
                <FileUp className="w-4 h-4" />
                {language === "en" ? "Confirm & Restore" : "Xác nhận khôi phục"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
