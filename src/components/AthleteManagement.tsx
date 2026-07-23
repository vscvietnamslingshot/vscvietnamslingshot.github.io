import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../context/LanguageContext";
import { Athlete, DistanceConfig, StoredAthleteList, Club, VSC_DEFAULT_LOGO } from "../types";
import { getUserProfileByEmail, saveVscSystemAthletes, subscribeToVscSystemAthletes, saveVscSystemClub, deleteVscSystemClub } from "../lib/firebaseService";
import * as XLSX from "xlsx";
import { 
  User, 
  Users,
  MapPin, 
  Calendar, 
  CreditCard, 
  Flag, 
  Search, 
  UserPlus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Camera, 
  Building,
  Image as ImageIcon,
  CheckCircle,
  PlusCircle,
  UserCheck,
  FileSpreadsheet,
  Download,
  Upload,
  RefreshCw,
  Trophy,
  ArrowUp,
  ArrowDown,
  Eye,
  GripVertical
} from "lucide-react";

interface AthleteManagementProps {
  athletes: Athlete[];
  setAthletes: React.Dispatch<React.SetStateAction<Athlete[]>>;
  distances: DistanceConfig[];
  shotsCount: number;
  storedAthleteLists: StoredAthleteList[];
  setStoredAthleteLists: React.Dispatch<React.SetStateAction<StoredAthleteList[]>>;
  currentActiveAthletes: Athlete[];
  setCurrentActiveAthletes: React.Dispatch<React.SetStateAction<Athlete[]>>;
  matchName: string;
  clubs: Club[];
  setClubs: React.Dispatch<React.SetStateAction<Club[]>>;
  currentUser?: any;
  forceTab?: "athletes" | "clubs" | "vsc_system";
  hideVscSystemTab?: boolean;
  userRole?: string;
}

export function deduplicateAthletes(list: Athlete[]): Athlete[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  return list.filter(a => {
    if (!a || !a.id) return false;
    const key = a.id.toString().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const AVATAR_MALE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f1f5f9'/><circle cx='50' cy='38' r='20' fill='%2364748b'/><path d='M22 85c0-14 11-22 28-22s28 8 28 22z' fill='%2364748b'/></svg>";
export const AVATAR_FEMALE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23fdf2f8'/><circle cx='50' cy='38' r='20' fill='%23ec4899'/><path d='M22 85c0-14 11-22 28-22s28 8 28 22z' fill='%23ec4899'/></svg>";

const PRESET_AVATARS = [
  AVATAR_MALE,
  AVATAR_FEMALE
];

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

const PRESET_COUNTRIES = [
  { code: "VN", name: "Việt Nam", emoji: "🇻🇳" },
  { code: "TH", name: "Thái Lan", emoji: "🇹🇭" },
  { code: "LA", name: "Lào", emoji: "🇱🇦" },
  { code: "KH", name: "Campuchia", emoji: "🇰🇭" },
  { code: "SG", name: "Singapore", emoji: "🇸🇬" },
  { code: "MY", name: "Malaysia", emoji: "🇲🇾" },
  { code: "ID", name: "Indonesia", emoji: "🇮🇩" },
  { code: "JP", name: "Nhật Bản", emoji: "🇯🇵" },
  { code: "KR", name: "Hàn Quốc", emoji: "🇰🇷" },
  { code: "US", name: "Hoa Kỳ", emoji: "🇺🇸" },
  { code: "OTHER", name: "Khác (Tự nhập)", emoji: "🌐" }
];

export const AthleteManagement: React.FC<AthleteManagementProps> = ({ 
  athletes, 
  setAthletes,
  distances,
  shotsCount,
  storedAthleteLists,
  setStoredAthleteLists,
  currentActiveAthletes,
  setCurrentActiveAthletes,
  matchName,
  clubs,
  setClubs,
  currentUser,
  forceTab,
  hideVscSystemTab,
  userRole
}) => {
  const { language, t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [leftTab, setLeftTab] = useState<"athletes" | "clubs" | "vsc_system">(forceTab || "athletes");

  const canModifyClub = (club: Club) => {
    if (userRole === "admin") return true;
    if (!club.creatorId) {
      return userRole === "admin" || userRole === "subAdmin";
    }
    return currentUser && club.creatorId === currentUser.uid;
  };

  useEffect(() => {
    if (forceTab) {
      setLeftTab(forceTab);
    }
  }, [forceTab]);
  const [vscSystemAthletes, setVscSystemAthletes] = useState<Athlete[]>(() => {
    try {
      const saved = localStorage.getItem("slingshot_vsc_system_athletes");
      return saved ? deduplicateAthletes(JSON.parse(saved)) : [];
    } catch {
      return [];
    }
  });

  // Sync with Firestore Cloud subscription
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribeToVscSystemAthletes((remoteAthletes) => {
        if (remoteAthletes) {
          const deduplicated = deduplicateAthletes(remoteAthletes);
          setVscSystemAthletes(deduplicated);
          localStorage.setItem("slingshot_vsc_system_athletes", JSON.stringify(deduplicated));
        }
      });
    } catch (err) {
      console.warn("Could not subscribe VSC system athletes:", err);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser]);

  const updateVscSystemAthletesAndKeepSync = async (newList: Athlete[]) => {
    const deduplicated = deduplicateAthletes(newList);
    setVscSystemAthletes(deduplicated);
    localStorage.setItem("slingshot_vsc_system_athletes", JSON.stringify(deduplicated));
    try {
      await saveVscSystemAthletes(deduplicated);
    } catch (err) {
      console.warn("Failed to sync system athletes to Firestore:", err);
    }
  };

  // Roster auto-save and synchronization is handled globally in the main App.tsx auto-save loop to ensure state consistency and prevent race conditions.

  const isVscTab = leftTab === "vsc_system";
  const currentRoster = isVscTab ? vscSystemAthletes : athletes;

  const moveAthleteUp = (athlete: Athlete, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentList = isVscTab ? vscSystemAthletes : athletes;
    const idx = currentList.findIndex(a => a.id === athlete.id);
    if (idx <= 0) return;

    const newList = [...currentList];
    const temp = newList[idx];
    newList[idx] = newList[idx - 1];
    newList[idx - 1] = temp;

    if (isVscTab) {
      updateVscSystemAthletesAndKeepSync(newList);
    } else {
      setAthletes(newList);
    }
  };

  const moveAthleteDown = (athlete: Athlete, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentList = isVscTab ? vscSystemAthletes : athletes;
    const idx = currentList.findIndex(a => a.id === athlete.id);
    if (idx === -1 || idx >= currentList.length - 1) return;

    const newList = [...currentList];
    const temp = newList[idx];
    newList[idx] = newList[idx + 1];
    newList[idx + 1] = temp;

    if (isVscTab) {
      updateVscSystemAthletesAndKeepSync(newList);
    } else {
      setAthletes(newList);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedId !== id) {
      setDragOverId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const currentList = isVscTab ? vscSystemAthletes : athletes;
    const sourceIdx = currentList.findIndex(a => a.id === draggedId);
    const targetIdx = currentList.findIndex(a => a.id === targetId);

    if (sourceIdx !== -1 && targetIdx !== -1) {
      const newList = [...currentList];
      const [draggedItem] = newList.splice(sourceIdx, 1);
      newList.splice(targetIdx, 0, draggedItem);

      if (isVscTab) {
        updateVscSystemAthletesAndKeepSync(newList);
      } else {
        setAthletes(newList);
      }
    }

    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleAddVscToTournament = (athlete: Athlete) => {
    const exists = currentActiveAthletes.some(a => a.id === athlete.id);
    if (exists) {
      alert(`Vận động viên "${athlete.name}" (ID: ${athlete.id}) đã có sẵn trong giải đấu hiện tại rồi!`);
    } else {
      const freshScores: Record<string, (boolean | null)[]> = {};
      distances.forEach((dist) => {
        freshScores[dist.id] = Array(shotsCount).fill(null);
      });

      const copiedAthlete: Athlete = {
        ...athlete,
        scores: freshScores,
      };

      setAthletes(prev => {
        const alreadyInMaster = prev.some(a => a.id === athlete.id);
        if (alreadyInMaster) {
          return prev.map(a => a.id === athlete.id ? copiedAthlete : a);
        }
        return [...prev, copiedAthlete];
      });
      setCurrentActiveAthletes(prev => {
        const alreadyInActive = prev.some(a => a.id === athlete.id);
        if (alreadyInActive) return prev;
        return [...prev, copiedAthlete];
      });

      setNotification({
        type: "success",
        message: `Đã nạp thành công VĐV "${athlete.name}" vào giải đấu hiện tại!`
      });
      setTimeout(() => setNotification(null), 3500);
    }
  };

  const [clubToDelete, setClubToDelete] = useState<Club | null>(null);
  const [athleteToDelete, setAthleteToDelete] = useState<Athlete | null>(null);
  const [listToDelete, setListToDelete] = useState<any | null>(null);
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [formTeam, setFormTeam] = useState("");
  const [formGender, setFormGender] = useState("Nam");
  const [formIdCard, setFormIdCard] = useState("");
  const [formDob, setFormDob] = useState("");
  const [formHometown, setFormHometown] = useState("");
  const [formProvince, setFormProvince] = useState("");
  const [formCountry, setFormCountry] = useState("Việt Nam");
  const [formCountryCode, setFormCountryCode] = useState("VN");
  const [formAvatarUrl, setFormAvatarUrl] = useState("");
  const [formStatus, setFormStatus] = useState("Thi đấu");
  const [formIsPrimaryTeam, setFormIsPrimaryTeam] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  
  const [validationError, setValidationError] = useState("");
  const [duplicateSysMatch, setDuplicateSysMatch] = useState<Athlete | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [expandedListId, setExpandedListId] = useState<string | null>(null);
  const [customSaveName, setCustomSaveName] = useState("");
  const [listIdToConfirmDelete, setListIdToConfirmDelete] = useState<string | null>(null);
  const [listIdToConfirmApply, setListIdToConfirmApply] = useState<string | null>(null);
  const [applyConfirmStep, setApplyConfirmStep] = useState<0 | 1 | 2>(0);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [resetConfirmStep, setResetConfirmStep] = useState<0 | 1 | 2>(0);

  // Drag and drop states
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // New Club state variables
  const [newClubName, setNewClubName] = useState("");
  const [newClubProvince, setNewClubProvince] = useState("");
  const [editingClubId, setEditingClubId] = useState<string | null>(null);
  const [editingClubName, setEditingClubName] = useState("");
  const [editingClubProvince, setEditingClubProvince] = useState("");
  const [editingClubAvatarUrl, setEditingClubAvatarUrl] = useState("");

  const filteredAthletes = currentRoster.filter(a => {
    const q = searchTerm.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      (a.team && a.team.toLowerCase().includes(q)) ||
      (a.province && a.province.toLowerCase().includes(q)) ||
      (a.idCard && a.idCard.includes(q))
    );
  });

  const handleSelectAthlete = (athlete: Athlete) => {
    setSelectedAthlete(athlete);
    setIsEditing(false);
    setIsCreating(false);
    setValidationError("");
    setDuplicateSysMatch(null);
    setIsConfirmingDelete(false);
  };

  const handleStartCreate = () => {
    setIsCreating(true);
    setIsEditing(false);
    setSelectedAthlete(null);
    setValidationError("");
    setDuplicateSysMatch(null);
    setIsConfirmingDelete(false);

    // Generate automatic unique ID string skipping any existing IDs
    let nextIdNum = 1;
    const allExistingIds = new Set([
      ...currentRoster.map((a) => a.id.trim().toLowerCase()),
      ...vscSystemAthletes.map((a) => a.id.trim().toLowerCase()),
      ...(currentActiveAthletes || []).map((a) => a.id.trim().toLowerCase()),
    ]);
    while (allExistingIds.has(nextIdNum.toString().padStart(4, "0").toLowerCase())) {
      nextIdNum++;
    }
    const finalIdStr = nextIdNum.toString().padStart(4, "0");

    setFormId(finalIdStr);
    setFormName("");
    setFormTeam("");
    setFormGender("Nam");
    setFormIdCard("");
    setFormDob("");
    setFormHometown("");
    setFormProvince("");
    setFormCountry("Việt Nam");
    setFormCountryCode("VN");
    setFormAvatarUrl(PRESET_AVATARS[0]);
    setFormStatus("Thi đấu");
    setFormIsPrimaryTeam(false);
    setFormEmail("");
  };

  const handleStartEdit = (athlete: Athlete) => {
    setIsEditing(true);
    setIsCreating(false);
    setValidationError("");
    setDuplicateSysMatch(null);

    setFormId(athlete.id);
    setFormName(athlete.name);
    setFormTeam(athlete.team);
    setFormGender(athlete.gender || "Nam");
    setFormIdCard(athlete.idCard || "");
    setFormDob(athlete.dob || "");
    setFormHometown(athlete.hometown || "");
    setFormProvince(athlete.province || "");
    setFormCountry(athlete.country || "Việt Nam");
    setFormCountryCode(athlete.countryCode || "VN");
    setFormAvatarUrl(athlete.avatarUrl || PRESET_AVATARS[0]);
    setFormStatus(athlete.status || "Thi đấu");
    setFormIsPrimaryTeam(!!athlete.isPrimaryTeam);
    setFormEmail(athlete.email || "");
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setFormCountryCode(code);
    if (code === "OTHER") {
      setFormCountry("");
    } else {
      const countryObj = PRESET_COUNTRIES.find(c => c.code === code);
      if (countryObj) {
        setFormCountry(countryObj.name);
      }
    }
  };

  const handleLoadCloudProfile = async (emailStr: string) => {
    if (!emailStr || !emailStr.trim()) {
      alert("Vui lòng điền Email trước khi tra cứu!");
      return;
    }
    try {
      const profile = await getUserProfileByEmail(emailStr);
      if (profile) {
        if (profile.displayName) setFormName(profile.displayName);
        if (profile.cccd) setFormIdCard(profile.cccd);
        if (profile.birthDate) setFormDob(profile.birthDate);
        if (profile.address) setFormHometown(profile.address);
        if (profile.province) setFormProvince(profile.province);
        if (profile.club) setFormTeam(profile.club);
        if (profile.avatarUrl || profile.photoURL) {
          setFormAvatarUrl(profile.avatarUrl || profile.photoURL);
        }
        alert(`Đã tìm thấy & tự động nạp thành công hồ sơ của vận động viên "${profile.displayName || emailStr}" từ đám mây Cloud!`);
      } else {
        alert(`Không tìm thấy hồ sơ cá nhân nào liên kết với email "${emailStr.trim()}" trên Cloud.`);
      }
    } catch (e) {
      console.error(e);
      alert("Không thể kết nối cơ sở dữ liệu tra cứu. Vui lòng kiểm tra lại mạng!");
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");
    setDuplicateSysMatch(null);

    if (!formName.trim()) {
      setValidationError("Vui lòng điền họ tên vận động viên.");
      return;
    }

    if (!formId.trim()) {
      setValidationError("Vui lòng nhập Mã số VĐV (ID).");
      return;
    }

    const trimmedId = formId.trim();

    // Check against VSC System Athletes database
    const matchedSys = vscSystemAthletes.find(
      (a) => a.id.trim().toLowerCase() === trimmedId.toLowerCase() && (!selectedAthlete || selectedAthlete.id.trim().toLowerCase() !== a.id.trim().toLowerCase())
    );

    // Check against Current Roster & Active Tournament Athletes
    const matchedRoster = currentRoster.find(
      (a) => a.id.trim().toLowerCase() === trimmedId.toLowerCase() && (!selectedAthlete || selectedAthlete.id.trim().toLowerCase() !== a.id.trim().toLowerCase())
    );

    const matchedActive = (currentActiveAthletes || []).find(
      (a) => a.id.trim().toLowerCase() === trimmedId.toLowerCase() && (!selectedAthlete || selectedAthlete.id.trim().toLowerCase() !== a.id.trim().toLowerCase())
    );

    if (isCreating) {
      if (matchedSys) {
        if (!isVscTab) {
          setDuplicateSysMatch(matchedSys);
          setValidationError(
            `⚠️ TRÙNG MÃ VĐV HỆ THỐNG: Mã số VĐV (ID) "${trimmedId}" đã thuộc về VĐV "${matchedSys.name}" (${matchedSys.team || "Chưa có CLB"}) trên Hệ thống VSC. Bạn không cần tạo mới VĐV này! Vui lòng chọn "Thêm ngay VĐV này vào giải" bên dưới, hoặc đổi Mã số VĐV (ID) khác để tiếp tục đăng ký.`
          );
          return;
        } else {
          setValidationError(
            `⚠️ TRÙNG MÃ VĐV HỆ THỐNG: Mã số VĐV (ID) "${trimmedId}" đã được đăng ký cho VĐV "${matchedSys.name}" (${matchedSys.team || "Tự do"}) trên Hệ thống VSC. Vui lòng thay đổi sang Mã số VĐV (ID) khác để tạo VĐV mới.`
          );
          return;
        }
      }

      if (matchedRoster || matchedActive) {
        const existingName = (matchedRoster || matchedActive)?.name;
        const existingTeam = (matchedRoster || matchedActive)?.team || "Tự do";
        setValidationError(
          `⚠️ TRÙNG MÃ VĐV GIẢI ĐẤU: Mã số VĐV (ID) "${trimmedId}" đã tồn tại trong danh sách giải đấu này (VĐV: "${existingName}" - ${existingTeam}). Vui lòng kiểm tra lại hoặc đổi Mã số VĐV khác.`
        );
        return;
      }
    } else if (isEditing && selectedAthlete && selectedAthlete.id.trim().toLowerCase() !== trimmedId.toLowerCase()) {
      if (matchedSys || matchedRoster || matchedActive) {
        const existingName = (matchedSys || matchedRoster || matchedActive)?.name;
        setValidationError(
          `⚠️ TRÙNG MÃ VĐV: Mã số VĐV (ID) "${trimmedId}" đã được đăng ký cho VĐV "${existingName}". Vui lòng chọn Mã số VĐV khác.`
        );
        return;
      }
    }

    if (isCreating) {
      // Build fresh scores matching configured distances
      const freshScores: Record<string, (boolean | null)[]> = {};
      distances.forEach((dist) => {
        freshScores[dist.id] = Array(shotsCount).fill(null);
      });

      const newAthlete: Athlete = {
        id: formId.trim(),
        name: formName.trim(),
        team: formTeam.trim(),
        gender: formGender,
        scores: freshScores,
        avatarUrl: formAvatarUrl,
        idCard: formIdCard.trim(),
        dob: formDob,
        hometown: formHometown.trim(),
        province: formProvince.trim(),
        country: formCountry,
        countryCode: formCountryCode,
        status: formStatus,
        isPrimaryTeam: formIsPrimaryTeam,
        email: formEmail.trim(),
      };

      if (isVscTab) {
        updateVscSystemAthletesAndKeepSync([...vscSystemAthletes, newAthlete]);
      } else {
        setAthletes(prev => [...prev, newAthlete]);
      }
      setSelectedAthlete(null);
      setIsCreating(false);
    } else if (isEditing && selectedAthlete) {
      if (isVscTab) {
        const updated = vscSystemAthletes.map(a => {
          if (a.id === selectedAthlete.id) {
            return {
              ...a,
              id: formId.trim(),
              name: formName.trim(),
              team: formTeam.trim(),
              gender: formGender,
              idCard: formIdCard.trim(),
              dob: formDob,
              hometown: formHometown.trim(),
              province: formProvince.trim(),
              country: formCountry,
              countryCode: formCountryCode,
              avatarUrl: formAvatarUrl,
              status: formStatus,
              isPrimaryTeam: formIsPrimaryTeam,
              email: formEmail.trim(),
            };
          }
          return a;
        });
        updateVscSystemAthletesAndKeepSync(updated);
      } else {
        setAthletes(prev => prev.map(a => {
          if (a.id === selectedAthlete.id) {
            return {
              ...a,
              id: formId.trim(),
              name: formName.trim(),
              team: formTeam.trim(),
              gender: formGender,
              idCard: formIdCard.trim(),
              dob: formDob,
              hometown: formHometown.trim(),
              province: formProvince.trim(),
              country: formCountry,
              countryCode: formCountryCode,
              avatarUrl: formAvatarUrl,
              status: formStatus,
              isPrimaryTeam: formIsPrimaryTeam,
              email: formEmail.trim(),
            };
          }
          return a;
        }));
      }

      setSelectedAthlete(null);
      setIsEditing(false);
    }

    // Auto-add new Club if name is manually entered (e.g. from Cloud Profile lookup) and doesn't exist yet
    const teamName = formTeam.trim();
    if (teamName) {
      const exists = clubs.some(c => c.name.toLowerCase() === teamName.toLowerCase());
      if (!exists) {
        const newClub: Club = {
          id: `club-${Date.now()}`,
          name: teamName,
          province: formProvince.trim() || "",
          avatarUrl: VSC_DEFAULT_LOGO,
          creatorId: currentUser?.uid || "",
          creatorEmail: currentUser?.email || ""
        };
        saveVscSystemClub(newClub).catch(err => console.error("Failed to save manually typed club globally:", err));
        setClubs(prev => [...prev, newClub]);
      }
    }
  };

  const handleDelete = (athlete: Athlete) => {
    setAthleteToDelete(athlete);
  };

  const handleAddClub = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newClubName.trim();
    if (!name) {
      alert("Vui lòng nhập tên danh nghĩa CLB!");
      return;
    }
    const dupe = clubs.some(c => c.name.toLowerCase() === name.toLowerCase());
    if (dupe) {
      alert("Tên Câu lạc bộ này đã tồn tại!");
      return;
    }
    const newClub: Club = {
      id: `club-${Date.now()}`,
      name: name,
      province: newClubProvince.trim(),
      avatarUrl: VSC_DEFAULT_LOGO,
      creatorId: currentUser?.uid || "",
      creatorEmail: currentUser?.email || ""
    };
    saveVscSystemClub(newClub).catch(err => console.error("Failed to save global club:", err));
    setClubs(prev => [...prev, newClub]);
    setNewClubName("");
    setNewClubProvince("");
    setNotification({ type: "success", message: `Đã thêm thành công CLB "${name}"!` });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleStartEditClub = (club: Club) => {
    if (!canModifyClub(club)) {
      alert("Bạn không có quyền chỉnh sửa câu lạc bộ này! Chỉ người tạo CLB hoặc Admin mới có quyền.");
      return;
    }
    setEditingClubId(club.id);
    setEditingClubName(club.name);
    setEditingClubProvince(club.province || "");
    setEditingClubAvatarUrl(club.avatarUrl || "");
  };

  const handleSaveEditClub = (clubId: string) => {
    const targetClub = clubs.find(c => c.id === clubId);
    if (targetClub && !canModifyClub(targetClub)) {
      alert("Bạn không có quyền chỉnh sửa câu lạc bộ này! Chỉ người tạo CLB hoặc Admin mới có quyền.");
      return;
    }
    const name = editingClubName.trim();
    if (!name) {
      alert("Tên CLB không được để trống!");
      return;
    }
    const updatedClub: Club = {
      ...targetClub!,
      name: name,
      province: editingClubProvince.trim(),
      avatarUrl: editingClubAvatarUrl || VSC_DEFAULT_LOGO,
    };
    saveVscSystemClub(updatedClub).catch(err => console.error("Failed to update global club:", err));
    setClubs(prev => prev.map(c => c.id === clubId ? updatedClub : c));
    setEditingClubId(null);
    setNotification({ type: "success", message: "Đã cập nhật thông tin CLB thành công!" });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteClub = (club: Club) => {
    if (!canModifyClub(club)) {
      alert("Bạn không có quyền xóa câu lạc bộ này! Chỉ người tạo CLB hoặc Admin mới có quyền.");
      return;
    }
    setClubToDelete(club);
  };

  // Generate fallback avatar containing initials
  const renderInitialsAvatar = (name: string) => {
    const parts = name.trim().split(" ");
    const initials = parts.length > 1 
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0] ? parts[0].substring(0, 2).toUpperCase() : "VDV";

    return (
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-bold text-lg border-2 border-white shadow-sm">
        {initials}
      </div>
    );
  };

  const getCountryEmoji = (code?: string) => {
    if (!code) return "🇻🇳";
    const match = PRESET_COUNTRIES.find(c => c.code === code);
    return match ? match.emoji : "🇻🇳";
  };

  // Excel and JSON Import/Export Logic
  const getValueByKeys = (row: any, keys: string[]): string => {
    for (const k of keys) {
      if (row[k] !== undefined) return String(row[k]);
      for (const rowKey of Object.keys(row)) {
        if (rowKey.toLowerCase().trim() === k.toLowerCase().trim()) {
          return String(row[rowKey]);
        }
      }
    }
    return "";
  };

  const exportToExcel = () => {
    try {
      const data = currentRoster.map(ath => ({
        "ID": ath.id,
        "Họ Tên": ath.name,
        "Câu Lạc Bộ": ath.team || "",
        "Giới Tính": ath.gender || "Nam",
        "Số CCCD / Thẻ": ath.idCard || "",
        "Ngày Sinh": ath.dob || "",
        "Quê Quán": ath.hometown || "",
        "Tỉnh Thành": ath.province || "",
        "Quốc Gia": ath.country || "Việt Nam",
        "Mã Quốc Gia": ath.countryCode || "VN",
        "Đường Dẫn Avatar": ath.avatarUrl || ""
      }));
      
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Danh Sách VĐV");
      XLSX.writeFile(workbook, isVscTab ? "Danh_Sach_Van_Dong_Vien_He_Thong_VSC.xlsx" : "Danh_Sach_Van_Dong_Vien_Giai.xlsx");
    } catch (err) {
      console.error(err);
      alert("Có lỗi xảy ra khi xuất file Excel!");
    }
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileReader = new FileReader();
    fileReader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        const idKeys = ["ID", "Mã VĐV", "Mã", "id", "Ma", "Mã số"];
        const nameKeys = ["Họ Tên", "Họ và Tên", "Tên", "name", "Ho Ten", "Tên VĐV", "Họ tên VĐV"];
        const teamKeys = ["Câu Lạc Bộ", "Đội", "CLB", "Don Vi", "Đơn Vị", "team", "Đoàn"];
        const genderKeys = ["Giới Tính", "Gioi Tinh", "gender", "Nam/Nữ", "Nam / Nữ"];
        const idCardKeys = ["Số CCCD / Thẻ", "Số CCCD", "CCCD", "CMND", "Số Thẻ", "idCard", "Căn cước"];
        const dobKeys = ["Ngày Sinh", "Ngay Sinh", "dob", "birth", "Năm sinh"];
        const hometownKeys = ["Quê Quán", "Que Quan", "hometown", "Nguyên quán"];
        const provinceKeys = ["Tỉnh Thành", "Tỉnh", "Tinh Thanh", "province", "Đơn vị chủ quản"];
        const countryKeys = ["Quốc Gia", "Quoc Gia", "country"];
        const countryCodeKeys = ["Mã Quốc Gia", "countryCode", "mã nước"];
        const avatarKeys = ["Đường Dẫn Avatar", "Avatar", "avatarUrl", "Ảnh", "Đường dẫn ảnh", "Link ảnh"];

        const importedAthletes: Athlete[] = jsonData.map((row: any) => {
          const freshScores: Record<string, (boolean | null)[]> = {};
          distances.forEach((dist) => {
            freshScores[dist.id] = Array(shotsCount).fill(null);
          });

          return {
            id: getValueByKeys(row, idKeys).trim(),
            name: getValueByKeys(row, nameKeys).trim(),
            team: getValueByKeys(row, teamKeys).trim(),
            gender: getValueByKeys(row, genderKeys).trim() || "Nam",
            idCard: getValueByKeys(row, idCardKeys).trim(),
            dob: getValueByKeys(row, dobKeys).trim(),
            hometown: getValueByKeys(row, hometownKeys).trim(),
            province: getValueByKeys(row, provinceKeys).trim(),
            country: getValueByKeys(row, countryKeys).trim() || "Việt Nam",
            countryCode: getValueByKeys(row, countryCodeKeys).trim() || "VN",
            avatarUrl: getValueByKeys(row, avatarKeys).trim(),
            scores: freshScores
          };
        }).filter(ath => ath.id && ath.name);

        if (importedAthletes.length === 0) {
          alert("Không tìm thấy dữ liệu vận động viên hợp lệ trong file Excel! Yêu cầu ít nhất cột ID và Họ Tên.");
          return;
        }

        if (window.confirm(`Tìm thấy ${importedAthletes.length} VĐV trong file Excel. Bạn có muốn ghi đè / nhập thêm vào danh sách hiện tại không? (Các VĐV trùng mã số ID sẽ được cập nhật thông tin)`)) {
          // Auto-add any imported clubs that don't exist yet
          const importedClubNames = Array.from(new Set(importedAthletes.map(a => a.team?.trim()).filter(Boolean)));
          if (importedClubNames.length > 0) {
            setClubs(prevClubs => {
              const updatedClubs = [...prevClubs];
              importedClubNames.forEach((cName, idx) => {
                const exists = updatedClubs.some(c => c.name.toLowerCase() === cName.toLowerCase());
                if (!exists) {
                  const newClub: Club = {
                    id: `club-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
                    name: cName,
                    province: "",
                    avatarUrl: VSC_DEFAULT_LOGO,
                    creatorId: currentUser?.uid || "",
                    creatorEmail: currentUser?.email || ""
                  };
                  saveVscSystemClub(newClub).catch(err => console.error("Failed to save imported club globally:", err));
                  updatedClubs.push(newClub);
                }
              });
              return updatedClubs;
            });
          }

          if (isVscTab) {
            const merged = [...vscSystemAthletes];
            importedAthletes.forEach(imp => {
              const idx = merged.findIndex(v => v.id === imp.id);
              if (idx >= 0) {
                merged[idx] = { 
                  ...merged[idx], 
                  ...imp 
                };
              } else {
                merged.push(imp);
              }
            });
            updateVscSystemAthletesAndKeepSync(merged);
          } else {
            setAthletes(prev => {
              const merged = [...prev];
              importedAthletes.forEach(imp => {
                const idx = merged.findIndex(v => v.id === imp.id);
                if (idx >= 0) {
                  merged[idx] = { 
                    ...merged[idx], 
                    ...imp, 
                    scores: merged[idx].scores || imp.scores 
                  };
                } else {
                  merged.push(imp);
                }
              });
              return merged;
            });
          }
          alert(`Đã nhập thành công ${importedAthletes.length} vận động viên!`);
        }
      } catch (err) {
        console.error(err);
        alert("Có lỗi xảy ra khi đọc file Excel. Vui lòng kiểm tra lại cấu trúc file!");
      }
    };
    fileReader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const exportToJson = () => {
    try {
      // Strip score fields for clean bio/personal data export
      const cleaned = currentRoster.map(({ scores, ...rest }) => rest);
      const blob = new Blob([JSON.stringify(cleaned, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = isVscTab ? "Danh_Sach_Van_Dong_Vien_He_Thong_VSC.json" : "Danh_Sach_Van_Dong_Vien_Giai.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Có lỗi xảy ra khi xuất file JSON!");
    }
  };

  const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileReader = new FileReader();
    fileReader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (!Array.isArray(parsed)) {
          alert("File JSON không hợp lệ! Dữ liệu phải là một mảng danh sách vận động viên.");
          return;
        }

        const validated: Athlete[] = parsed.filter(ath => ath && typeof ath === 'object' && ath.id && ath.name);

        if (validated.length === 0) {
          alert("Không tìm thấy dữ liệu vận động viên hợp lệ trong file JSON! Vui lòng đảm bảo các đối tượng có thuộc tính 'id' và 'name'.");
          return;
        }

        if (window.confirm(`Tìm thấy ${validated.length} VĐV trong file JSON (bao gồm đầy đủ thông tin và đường dẫn ảnh). Bạn có muốn gộp/ghi đè vào danh sách hiện tại không?`)) {
          if (isVscTab) {
            const merged = [...vscSystemAthletes];
            validated.forEach(imp => {
              const idx = merged.findIndex(v => v.id === imp.id);
              if (idx >= 0) {
                merged[idx] = imp;
              } else {
                merged.push(imp);
              }
            });
            updateVscSystemAthletesAndKeepSync(merged);
          } else {
            setAthletes(prev => {
              const merged = [...prev];
              validated.forEach(imp => {
                if (!imp.scores) {
                  const freshScores: Record<string, (boolean | null)[]> = {};
                  distances.forEach((dist) => {
                    freshScores[dist.id] = Array(shotsCount).fill(null);
                  });
                  imp.scores = freshScores;
                }
                const idx = merged.findIndex(v => v.id === imp.id);
                if (idx >= 0) {
                  merged[idx] = imp;
                } else {
                  merged.push(imp);
                }
              });
              return merged;
            });
          }
          alert(`Đã nhập thành công ${validated.length} vận động viên từ file JSON!`);
        }
      } catch (err) {
        console.error(err);
        alert("Có lỗi xảy ra khi đọc file JSON. Hãy đảm bảo file đúng định dạng JSON!");
      }
    };
    fileReader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full" id="athlete-management-container">
      
      {/* COLUMN 1: Profiles List */}
      <div className="w-full lg:w-[60%] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col gap-4">
        
        {/* Tab Selector */}
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-full mb-1 shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setLeftTab("athletes")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
              leftTab === "athletes"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-805/80 font-extrabold"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-medium"
            }`}
          >
            👥 {language === "en" ? "Roster" : "VĐV giải"} ({athletes.length})
          </button>
          <button
            type="button"
            onClick={() => setLeftTab("clubs")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
              leftTab === "clubs"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-805/80 font-extrabold"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-medium"
            }`}
          >
            🏢 {language === "en" ? "Clubs" : "Câu Lạc Bộ"} ({clubs.length})
          </button>
          {!hideVscSystemTab && (
            <button
              type="button"
              onClick={() => setLeftTab("vsc_system")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                leftTab === "vsc_system"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-805/80 font-extrabold"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-medium"
              }`}
            >
              🎖️ {language === "en" ? "VSC Database" : "Hệ thống VSC"} ({vscSystemAthletes.length})
            </button>
          )}
        </div>

        {(leftTab === "athletes" || leftTab === "vsc_system") ? (
          <>
            <div className="flex justify-between items-center pb-2 border-b">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 dark:text-slate-100">
                <Users className="w-5 h-5 text-blue-600" />
                {isVscTab 
                  ? (language === "en" ? "VSC Database Athletes" : "VĐV Hệ Thống VSC") 
                  : (language === "en" ? "Tournament Athletes" : "Vận Động Viên Giải")} ({currentRoster.length})
              </h2>
              
              <button
                type="button"
                onClick={handleStartCreate}
                className="p-1.5 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold flex items-center gap-1 transition-all cursor-pointer"
                title={isVscTab 
                  ? (language === "en" ? "Add new system athlete profile" : "Thêm lý lịch VĐV Hệ thống cố định mới") 
                  : (language === "en" ? "Add new tournament athlete" : "Thêm VĐV giải mới")}
              >
                <UserPlus className="w-3.5 h-3.5" /> {language === "en" ? "Add New" : "Thêm mới"}
              </button>
            </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={language === "en" ? "Search by Name, ID, Province..." : "Tìm theo Tên, Mã, Tỉnh..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>

        {/* Import/Export Data Panel */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-gray-200 dark:border-slate-800 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
              {language === "en" ? "Roster File Manager" : "Quản Lý File VĐV"}
            </span>
            <span className="text-[9px] text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold font-mono">XLSX & JSON</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {/* Excel Group */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-gray-400 flex items-center gap-1">
                <FileSpreadsheet className="w-3 h-3 text-emerald-600" /> {language === "en" ? "Excel Table (.xlsx)" : "Bảng Excel (.xlsx)"}
              </span>
              <div className="flex gap-1">
                <label 
                  className="flex-1 text-center bg-white hover:bg-emerald-50 dark:bg-slate-900 dark:hover:bg-emerald-950/20 text-emerald-700 p-1.5 rounded-lg text-[10px] font-bold cursor-pointer border border-emerald-200 dark:border-emerald-900/40 transition-all flex items-center justify-center gap-0.5 shadow-sm" 
                  title={language === "en" ? "Choose Excel file to import athlete list" : "Chọn file Excel để tải danh sách vận động viên"}
                >
                  <Upload className="w-3 h-3" /> {language === "en" ? "Import" : "Nhập"}
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleExcelImport}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={exportToExcel}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-0.5 shadow-sm"
                  title={language === "en" ? "Download Excel file containing current athletes" : "Tải về file Excel chứa danh sách VĐV hiện hành"}
                >
                  <Download className="w-3 h-3" /> {language === "en" ? "Export" : "Xuất"}
                </button>
              </div>
            </div>

            {/* JSON Group */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-gray-400 flex items-center gap-1">
                <span className="text-violet-600 font-mono font-black text-xs leading-none">{"{}"}</span> {language === "en" ? "JSON Data (.json)" : "Dữ liệu JSON (.json)"}
              </span>
              <div className="flex gap-1">
                <label 
                  className="flex-1 text-center bg-white hover:bg-violet-50 dark:bg-slate-900 dark:hover:bg-violet-950/20 text-violet-700 p-1.5 rounded-lg text-[10px] font-bold cursor-pointer border border-violet-200 dark:border-violet-900/40 transition-all flex items-center justify-center gap-0.5 shadow-sm" 
                  title={language === "en" ? "Choose JSON file to import athletes" : "Chọn file JSON để tải lên đầy đủ VĐV và điểm số"}
                >
                  <Upload className="w-3 h-3" /> {language === "en" ? "Import" : "Nhập"}
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleJsonImport}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={exportToJson}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white p-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-0.5 shadow-sm"
                  title={language === "en" ? "Download JSON file" : "Tải về file JSON"}
                >
                  <Download className="w-3 h-3" /> {language === "en" ? "Export" : "Xuất"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Reset list option */}
        {currentRoster.length > 0 && (
          <div className="pt-1.5 flex flex-col gap-1.5 border-b border-gray-150 dark:border-slate-800/60 pb-2.5">
            {resetConfirmStep === 0 ? (
              <button
                type="button"
                onClick={() => setResetConfirmStep(1)}
                className="w-full py-1.5 px-3 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 rounded-lg border border-rose-200 dark:border-rose-900/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98]"
              >
                <Trash2 className="w-3.5 h-3.5" /> 
                Xóa tất cả {currentRoster.length} VĐV hiện tại (Reset)
              </button>
            ) : resetConfirmStep === 1 ? (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 p-2.5 rounded-xl flex flex-col gap-1.5 text-xs text-amber-900 dark:text-amber-300 animate-fadeIn font-extrabold shadow-sm">
                <span className="text-center font-bold text-[10px] text-amber-800 dark:text-amber-400 leading-snug">
                  ⚠️ XÁC NHẬN LẦN 1: Bạn có chắc chắn muốn xóa hết {currentRoster.length} VĐV?
                </span>
                <div className="flex gap-1.5 w-full">
                  <button
                    type="button"
                    onClick={() => setResetConfirmStep(2)}
                    className="flex-1 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-black text-[10.5px] cursor-pointer shadow-sm transition-colors"
                  >
                    Xác nhận lần 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetConfirmStep(0)}
                    className="py-1 px-3 bg-gray-250 text-slate-700 dark:text-slate-350 rounded font-bold text-[10.5px] cursor-pointer transition-colors"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-900 p-2.5 rounded-xl flex flex-col gap-1.5 text-xs text-red-900 dark:text-red-300 animate-fadeIn font-extrabold shadow-sm">
                <span className="text-center font-bold text-[10.5px] text-red-700 dark:text-red-400 leading-snug">
                  🚨 XÁC NHẬN LẦN 2 (CẢNH BÁO): Chắc chắn xóa VĨNH VIỄN?
                </span>
                <div className="flex gap-1.5 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      if (isVscTab) {
                        updateVscSystemAthletesAndKeepSync([]);
                      } else {
                        setAthletes([]);
                      }
                      setResetConfirmStep(0);
                      setNotification({
                        type: "success",
                        message: "Đã reset sạch sẽ danh sách vận động viên!"
                      });
                      setTimeout(() => setNotification(null), 3500);
                    }}
                    className="flex-1 py-1.5 bg-red-650 hover:bg-red-700 text-white rounded font-black text-[10.5px] cursor-pointer shadow-md transition-colors"
                  >
                    CÓ, XÓA TOÀN BỘ VĐV
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetConfirmStep(0)}
                    className="py-1.5 px-3 bg-gray-250 text-slate-700 rounded font-bold text-[10.5px] cursor-pointer transition-colors"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Athletes roster */}
        <div className="flex-1 overflow-y-auto space-y-1 my-1 max-h-[500px] pr-1">
          {filteredAthletes.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-xs italic">
              Không tìm thấy hồ sơ nào trùng khớp.
            </div>
          ) : (
            filteredAthletes.map((ath) => {
              const isActive = selectedAthlete && selectedAthlete.id === ath.id;
              return (
                <div
                  key={ath.id}
                  onClick={() => handleSelectAthlete(ath)}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, ath.id)}
                  onDragOver={(e) => handleDragOver(e, ath.id)}
                  onDrop={(e) => handleDrop(e, ath.id)}
                  onDragEnd={handleDragEnd}
                  className={`p-2.5 rounded-lg flex items-center justify-between gap-3 cursor-grab active:cursor-grabbing transition-all border ${
                    isActive 
                      ? "border-blue-500 bg-blue-50/50" 
                      : dragOverId === ath.id
                      ? "border-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/20"
                      : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  } ${draggedId === ath.id ? "opacity-45" : ""}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <GripVertical className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0 cursor-grab" />

                    <img 
                      src={ath.avatarUrl || AVATAR_MALE} 
                      alt={ath.name}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                    />

                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
                        <span className="truncate">{ath.name}</span>
                        <span className="text-[10px] font-mono text-gray-400 shrink-0">({ath.id})</span>
                        {ath.isPrimaryTeam && (
                          <span className="px-1 text-[8.5px] font-extrabold uppercase bg-indigo-50 text-indigo-700 rounded border border-indigo-200 shadow-xs shrink-0 select-none">
                            Bắn chính
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-400 truncate">
                        <span>{ath.team || "VĐV Tự do"}</span>
                        {ath.province && (
                          <>
                            <span>&bull;</span>
                            <span className="flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5" />
                              {ath.province}
                            </span>
                          </>
                        )}
                        <span>&bull;</span>
                        <span>{getCountryEmoji(ath.countryCode)}</span>
                        {ath.status === "Bỏ thi" ? (
                          <span className="ml-[3px] px-1 py-0.2 bg-red-50 text-red-600 font-bold text-[8.5px] rounded border border-red-150 shrink-0 dark:bg-rose-950/25 dark:text-rose-400 dark:border-rose-900/10">Bỏ thi</span>
                        ) : (
                          <span className="ml-[3px] px-1 py-0.2 bg-emerald-50 text-emerald-600 font-bold text-[8.5px] rounded border border-emerald-150 shrink-0 dark:bg-emerald-950/25 dark:text-emerald-400 dark:border-emerald-900/10 font-medium">Thi đấu</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Reordering & Options Panel */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => moveAthleteUp(ath, e)}
                        className="p-1 hover:bg-slate-150 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                        title="Di chuyển lên"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => moveAthleteDown(ath, e)}
                        className="p-1 hover:bg-slate-150 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                        title="Di chuyển xuống"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {isVscTab ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddVscToTournament(ath);
                        }}
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all cursor-pointer flex items-center justify-center text-[10px] font-bold gap-0.5 shadow-sm hover:scale-105 active:scale-95"
                        title={language === "en" ? "Add this athlete to the current active tournament roster" : "Thêm VĐV này vào danh sách giải thi đấu hiện tại"}
                      >
                        <PlusCircle className="w-3.5 h-3.5" /> {language === "en" ? "Add to Tournament" : "Thêm vào giải"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(ath);
                        }}
                        className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-all cursor-pointer flex items-center justify-center text-[10px] font-bold gap-0.5 shadow-sm hover:scale-105 active:scale-95"
                        title={language === "en" ? "Delete this athlete" : "Xóa VĐV"}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> {language === "en" ? "Delete Athlete" : "Xóa VĐV"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
          </>
        ) : (
          <>
            {/* Tab 2: Câu Lạc Bộ */}
            <div className="flex flex-col gap-4 animate-fadeIn font-sans">
              <div className="flex flex-col border-b dark:border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Building className="w-5 h-5 text-indigo-600" />
                  Danh Sách Câu Lạc Bộ ({clubs.length})
                </h3>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 leading-snug">
                  Quản lý logo, tên danh nghĩa hoặc tỉnh địa phương cho các câu lạc bộ bắn ná.
                </p>
              </div>

              {/* Quick Add Club Form inside left column */}
              <form onSubmit={handleAddClub} className="bg-slate-50 dark:bg-slate-950/40 border border-gray-200 dark:border-slate-800 rounded-xl p-3.5 flex flex-col gap-2.5 shadow-2xs">
                <div className="w-full">
                  <label className="block text-[9.5px] font-black uppercase text-slate-500 tracking-wider mb-1">Tên Câu Lạc Bộ / Đội Tuyển <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sài Gòn Slingshot"
                    value={newClubName}
                    onChange={(e) => setNewClubName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-850 border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div className="w-full">
                  <label className="block text-[9.5px] font-black uppercase text-slate-500 tracking-wider mb-1">Tỉnh / Thành Phố</label>
                  <input
                    type="text"
                    placeholder="e.g. TP. Hồ Chí Minh"
                    value={newClubProvince}
                    onChange={(e) => setNewClubProvince(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-850 border border-gray-300 dark:border-slate-705 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-550 text-slate-900 dark:text-white font-medium"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-[0.98]"
                >
                  <PlusCircle className="w-4 h-4" /> Thêm CLB
                </button>
              </form>

              {/* Clubs list */}
              {clubs.length === 0 ? (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-xs italic border border-dashed rounded-xl">
                  Chưa có CLB nào. Hãy thêm ở trên.
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1">
                  {clubs.map((club) => {
                    const isEditingClub = editingClubId === club.id;
                    const athleteCount = athletes.filter(a => a.team?.trim().toLowerCase() === club.name.trim().toLowerCase()).length;
                    
                    return (
                      <div
                        key={club.id}
                        className="border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 bg-white dark:bg-slate-950/25 flex items-center justify-between gap-3 hover:border-indigo-300 dark:hover:border-indigo-900 transition-all shadow-3xs"
                      >
                        {/* Avatar & Info */}
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          {/* Club Avatar with click to upload */}
                          <div className="relative group shrink-0 w-9.5 h-9.5 rounded-xl overflow-hidden border border-slate-200/80 bg-slate-50 dark:bg-slate-900 dark:border-slate-800 flex items-center justify-center">
                            {isEditingClub ? (
                              <>
                                <img
                                  src={editingClubAvatarUrl || VSC_DEFAULT_LOGO}
                                  alt="Uploading club logo"
                                  className="w-full h-full object-cover animate-pulse"
                                />
                                <label className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[8px] font-black uppercase text-center leading-none">
                                  Đổi
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
                                            compressImage(reader.result, 80, 80).then((compressed) => {
                                              setEditingClubAvatarUrl(compressed);
                                            });
                                          }
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                  />
                                </label>
                              </>
                            ) : (
                              <img
                                src={club.avatarUrl || VSC_DEFAULT_LOGO}
                                alt={club.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            )}
                          </div>

                          {/* Text fields */}
                          <div className="flex-1 min-w-0 font-sans">
                            {isEditingClub ? (
                              <div className="flex flex-col gap-1">
                                <input
                                  type="text"
                                  value={editingClubName}
                                  onChange={(e) => setEditingClubName(e.target.value)}
                                  className="px-2 py-0.5 text-xs font-bold border rounded focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 font-sans"
                                  placeholder="Tên câu lạc bộ"
                                />
                                <input
                                  type="text"
                                  value={editingClubProvince}
                                  onChange={(e) => setEditingClubProvince(e.target.value)}
                                  className="px-2 py-0.5 text-[10px] border rounded focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700"
                                  placeholder="Tỉnh / Thành phố"
                                />
                              </div>
                            ) : (
                              <>
                                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 block truncate leading-snug">
                                  {club.name}
                                </span>
                                <span className="text-[9.5px] text-gray-400 dark:text-gray-500 flex items-center gap-0.5 mt-0.5 leading-none">
                                  <MapPin className="w-2.5 h-2.5 text-gray-400" />
                                  {club.province || "Chưa rõ tỉnh"} &bull;{" "}
                                  <strong className="text-indigo-600 dark:text-indigo-400 font-bold">
                                    {athleteCount} VĐV
                                  </strong>
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 shrink-0 ml-1">
                          {isEditingClub ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveEditClub(club.id)}
                                className="p-1 px-2.5 bg-emerald-600 hover:bg-emerald-750 text-white rounded text-[10px] font-bold cursor-pointer transition-all shrink-0 font-sans"
                              >
                                Lưu
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingClubId(null)}
                                className="p-1 px-2 bg-gray-105 hover:bg-gray-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-705 dark:text-slate-300 rounded text-[10px] cursor-pointer font-sans"
                              >
                                Hủy
                              </button>
                            </>
                          ) : (
                            <>
                              {canModifyClub(club) && (
                                <button
                                  type="button"
                                  onClick={() => handleStartEditClub(club)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded transition-all cursor-pointer"
                                  title="Sửa CLB"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canModifyClub(club) && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteClub(club)}
                                  className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded transition-all cursor-pointer"
                                  title="Xóa CLB"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* COLUMN 2 & 3: Persistent Athlete Roster Panel & Quick Guidelines */}
      <div className="w-full lg:w-[40%] flex flex-col gap-6">
        
        {/* Persistent Roster Panel - clubs are managed in Tab 2 on the left side */}
        {false ? (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-5 animate-fadeIn">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b dark:border-slate-800 pb-3 gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Building className="w-5 h-5 text-indigo-600" />
                  Danh Sách Câu Lạc Bộ & Đội Tuyển ({clubs.length})
                </h3>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Thêm mới, cập nhật logo hoặc tỉnh địa phương cho các câu lạc bộ bắn ná / đội tuyển.
                </p>
              </div>
            </div>

            {/* Quick Add Club Form */}
            <form onSubmit={handleAddClub} className="bg-slate-50 dark:bg-slate-950/40 border border-gray-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Tên Câu Lạc Bộ / Đội Tuyển <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sài Gòn Slingshot"
                  value={newClubName}
                  onChange={(e) => setNewClubName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-850 border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                />
              </div>
              <div className="w-full sm:w-48">
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Tỉnh / Thành Phố</label>
                <input
                  type="text"
                  placeholder="e.g. TP. Hồ Chí Minh"
                  value={newClubProvince}
                  onChange={(e) => setNewClubProvince(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-850 border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                className="w-full sm:w-auto px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black shadow-sm transition-all h-[34px] flex items-center justify-center gap-1 shrink-0 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" /> Thêm CLB
              </button>
            </form>

            {/* Clubs Grid/List view */}
            {clubs.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-xs italic border border-dashed rounded-xl">
                Chưa có câu lạc bộ nào trong danh sách. Hãy tự nhập tên CLB khi thêm VĐV hoặc điền form ở trên.
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-[450px] overflow-y-auto pr-1">
                {clubs.map((club) => {
                  const isEditingClub = editingClubId === club.id;
                  const athleteCount = athletes.filter(a => a.team?.trim().toLowerCase() === club.name.trim().toLowerCase()).length;

                  return (
                    <div
                      key={club.id}
                      className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-950/50 flex items-center justify-between gap-4 hover:border-indigo-300 dark:hover:border-indigo-900 transition-all shadow-sm"
                    >
                      {/* Avatar & Info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Club Avatar with click to upload */}
                        <div className="relative group shrink-0 w-11 h-11 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
                          {isEditingClub ? (
                            <>
                              <img
                                src={editingClubAvatarUrl || VSC_DEFAULT_LOGO}
                                alt="Uploading club logo"
                                className="w-full h-full object-cover"
                              />
                              <label className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[8px] font-black uppercase text-center leading-none">
                                Đổi ảnh
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
                                          compressImage(reader.result, 120, 120).then((compressed) => {
                                            setEditingClubAvatarUrl(compressed);
                                          });
                                        }
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                />
                              </label>
                            </>
                          ) : (
                            <img
                              src={club.avatarUrl || VSC_DEFAULT_LOGO}
                              alt={club.name}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>

                        {/* Text fields */}
                        <div className="flex-1 min-w-0">
                          {isEditingClub ? (
                            <div className="flex flex-col gap-1.5">
                              <input
                                type="text"
                                value={editingClubName}
                                onChange={(e) => setEditingClubName(e.target.value)}
                                className="px-2 py-0.5 text-xs font-bold border rounded focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                placeholder="Tên câu lạc bộ"
                              />
                              <input
                                type="text"
                                value={editingClubProvince}
                                onChange={(e) => setEditingClubProvince(e.target.value)}
                                className="px-2 py-0.5 text-[10.5px] border rounded focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                placeholder="Tỉnh / Thành phố"
                              />
                            </div>
                          ) : (
                            <>
                              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 block truncate">
                                {club.name}
                              </span>
                              <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-gray-400" />
                                {club.province || "Chưa cập nhật tỉnh thành"} &bull;{" "}
                                <strong className="text-indigo-650 dark:text-indigo-400 font-bold">
                                  {athleteCount} VĐV
                                </strong>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Edit/Delete control keys */}
                      <div className="flex items-center gap-1 border-l pl-3 dark:border-slate-800 shrink-0">
                        {isEditingClub ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSaveEditClub(club.id)}
                              className="p-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer"
                            >
                              Lưu
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingClubId(null)}
                              className="p-1 px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-[10px] cursor-pointer"
                            >
                              Hủy
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartEditClub(club)}
                              className="p-1.5 text-slate-500 hover:text-indigo-650 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                              title="Sửa thông tin CLB"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteClub(club)}
                              className="p-1.5 text-rose-600 hover:text-white hover:bg-rose-650 rounded-lg transition-all cursor-pointer"
                              title="Xóa CLB"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Persistent Roster List */
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-5 animate-fadeIn">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b dark:border-slate-800 pb-3 gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-indigo-600" />
                  Danh sách VĐV theo Giải đã lưu ({storedAthleteLists?.length || 0})
                </h3>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Chọn danh sách đã lưu từ các giải trước để áp dụng lại nhanh cho giải đấu đang chơi.
                </p>
              </div>
            </div>

            {/* Manual Save Current Active Athletes structure as requested */}
            {athletes && athletes.length > 0 && (
              <div className="bg-indigo-50/45 dark:bg-indigo-950/20 border border-indigo-150 dark:border-indigo-900 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-left w-full sm:w-auto">
                  <span className="text-[11px] font-bold text-indigo-805 dark:text-indigo-400 flex items-center gap-1 uppercase tracking-wide">
                    <CheckCircle className="w-4 h-4 text-indigo-650" />
                    Giải hiện hành đang có {athletes.length} VĐV trong danh sách
                  </span>
                  <p className="text-[11px] text-slate-505 dark:text-slate-400 mt-1 leading-relaxed">
                    Hệ thống sẽ <strong>tự động đồng bộ và lưu đè</strong> danh sách này trùng với tên giải đấu <strong className="text-indigo-605">"{matchName || "Giải đấu hiện tại"}"</strong> bất cứ khi nào có thay đổi, hoặc thầy cô có thể lưu với tên tùy chỉnh khác dưới đây.
                  </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="Nhập tên lưu (e.g. Giải Bán kết)..."
                    value={customSaveName}
                    onChange={(e) => setCustomSaveName(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white dark:bg-slate-850 border border-gray-305 dark:border-slate-705 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-505 font-bold flex-1 sm:flex-none sm:w-48 text-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const nameToUse = customSaveName.trim() || matchName;
                      if (!nameToUse) {
                        setNotification({ type: "error", message: "Vui lòng nhập tên cho danh sách lưu trữ!" });
                        setTimeout(() => setNotification(null), 3005);
                        return;
                      }
                      const newListRecord: StoredAthleteList = {
                        id: `list-${Date.now()}`,
                        name: nameToUse,
                        createdAt: new Date().toISOString(),
                        athletes: JSON.parse(JSON.stringify(athletes)),
                      };
                      setStoredAthleteLists((prev) => {
                        const filtered = prev.filter((item) => item.name.toLowerCase() !== nameToUse.toLowerCase());
                        return [newListRecord, ...filtered];
                      });
                      setCustomSaveName("");
                      setNotification({ type: "success", message: `Đã lưu danh sách "${nameToUse}" thành công!` });
                      setTimeout(() => setNotification(null), 4000);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4 py-2 rounded-lg transition-all shadow-sm shrink-0 cursor-pointer"
                  >
                    Lưu Roster
                  </button>
                </div>
              </div>
            )}

            {/* Stored Lists collection */}
            {!storedAthleteLists || storedAthleteLists.length === 0 ? (
              <div className="text-center py-8 bg-slate-55 dark:bg-slate-950/20 border border-dashed rounded-xl p-6 text-gray-400 dark:text-gray-500 text-xs italic">
                Không có danh sách lưu trữ nào. Các danh sách sẽ tự động được thu lại khi một giải đấu mới được thiết lập.
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
                {storedAthleteLists.map((item) => {
                  const isExpanded = expandedListId === item.id;
                  const isConfirmingD = listIdToConfirmDelete === item.id;
                  const isConfirmingA = listIdToConfirmApply === item.id;

                  return (
                    <div 
                      key={item.id}
                      className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-950/50 flex flex-col gap-3 hover:border-indigo-300 dark:hover:border-indigo-900 transition-all shadow-sm"
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="min-w-0">
                          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 block truncate font-sans">
                            {item.name}
                          </span>
                          <span className="text-[10px] text-gray-400 block mt-0.5">
                            Tạo ngày: {new Date(item.createdAt).toLocaleString("vi-VN")} &bull;{" "}
                            <strong className="text-indigo-605 dark:text-indigo-400 font-bold">
                              {item.athletes?.length || 0} vận động viên
                            </strong>
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end">
                          <button
                            type="button"
                            onClick={() => setExpandedListId(isExpanded ? null : item.id)}
                            className="p-1.5 text-slate-500 hover:text-indigo-650 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg transition-all text-xs flex items-center gap-1 font-bold cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Xem ({item.athletes?.length || 0})</span>
                          </button>

                          {!isConfirmingA ? (
                            <button
                              type="button"
                              onClick={() => {
                                setListIdToConfirmApply(item.id);
                                setApplyConfirmStep(1);
                                setListIdToConfirmDelete(null);
                              }}
                              className="p-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.01] text-white rounded-lg text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer shadow-sm shadow-emerald-250"
                            >
                              <RefreshCw className="w-3" />
                              <span>Áp dụng</span>
                            </button>
                          ) : applyConfirmStep === 1 ? (
                            <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-955 px-2 py-1 rounded border border-amber-300">
                              <span className="text-[10px] text-amber-805 dark:text-amber-450 font-bold whitespace-nowrap">
                                ⚠️ Nạp bốc thăm?
                              </span>
                              <button
                                type="button"
                                onClick={() => setApplyConfirmStep(2)}
                                className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[9px] cursor-pointer"
                              >
                                Tiếp tục
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setListIdToConfirmApply(null);
                                  setApplyConfirmStep(0);
                                }}
                                className="px-2 py-0.5 bg-gray-255 text-slate-705 rounded font-normal text-[9px] cursor-pointer"
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-955 px-2 py-1 rounded border border-rose-300">
                              <span className="text-[10px] text-rose-800 dark:text-rose-400 font-bold animate-pulse whitespace-nowrap">
                                🚨 Điểm giải đấu đang chơi sẽ RESET! Đánh đổi?
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const applied = item.athletes.map(a => {
                                    const freshScores: Record<string, (boolean | null)[]> = {};
                                    distances.forEach(d => {
                                      freshScores[d.id] = Array(shotsCount).fill(null);
                                    });
                                    return {
                                      ...a,
                                      scores: freshScores
                                    };
                                  });
                                  setAthletes(applied);
                                  setListIdToConfirmApply(null);
                                  setApplyConfirmStep(0);
                                  setNotification({
                                    type: "success",
                                    message: `Đã nạp thành công ${applied.length} vận động viên vào giải hiện hành!`
                                  });
                                  setTimeout(() => setNotification(null), 4000);
                                }}
                                className="px-2 py-0.5 bg-rose-600 text-white rounded font-bold text-[9px] cursor-pointer"
                              >
                                NẠP NGAY
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setListIdToConfirmApply(null);
                                  setApplyConfirmStep(0);
                                }}
                                className="px-2 py-0.5 bg-gray-250 text-slate-700 rounded font-normal text-[9px]"
                              >
                                Hủy
                              </button>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setListToDelete(item);
                            }}
                            className="p-1.5 text-rose-500 hover:text-white bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
                            title="Xóa danh sách"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg animate-fadeIn text-[11px] flex flex-col gap-1 text-slate-650 dark:text-slate-300">
                          <span className="font-bold border-b dark:border-slate-800 pb-1 text-gray-500 block mb-1">
                            Thành viên trong lưu trữ ({item.athletes?.length || 0}):
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-45 overflow-y-auto">
                            {(item.athletes || []).map((ath, idx) => {
                              if (!ath) return null;
                              return (
                                <div key={`${ath.id || idx}-${idx}`} className="flex items-center gap-1.5 bg-white dark:bg-slate-950 p-1 px-2 rounded border border-gray-150 dark:border-slate-850">
                                  <span className="font-mono text-indigo-650 dark:text-indigo-400 font-bold font-sans">#{idx + 1}</span>
                                  <span className="font-semibold text-slate-815 dark:text-slate-200 truncate flex-1">{ath.name || "Không rõ"}</span>
                                  <span className="text-[9px] text-gray-400 px-1">({ath.team || "Tự do"})</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Informational Guidance card */}
        <div className="bg-slate-50 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 text-indigo-650 flex items-center justify-center shrink-0 shadow-sm shadow-indigo-100">
            <Users className="w-7 h-7" />
          </div>
          <div className="text-center md:text-left">
            <h3 className="text-xs sm:text-sm font-bold text-slate-808 dark:text-slate-200 uppercase tracking-widest leading-none">HỆ THỐNG QUẢN LÝ VĐV SLINGSHOT</h3>
            <p className="text-[11px] text-slate-505 dark:text-slate-400 mt-1 leading-relaxed max-w-xl">
              Chọn bất kỳ đấu thủ nào bên trái hoặc bấm <strong>&quot;+ Thêm mới&quot;</strong> để mở ngay popup hồ sơ chi tiết. Dữ liệu roster giải đấu của bạn luôn lưu trữ cực kỳ bền bỉ và thuận tiện quản lý.
            </p>
          </div>
        </div>

      </div>
      
      {/* Club Deletion Confirmation Modal */}
      {clubToDelete && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
          onClick={() => setClubToDelete(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-800 animate-scaleUp p-6 flex flex-col gap-4 text-slate-800 dark:text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-50 dark:bg-rose-950/30 rounded-full">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-101 uppercase tracking-wide">Xác nhận xóa Câu lạc bộ?</h3>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
              Bạn có chắc chắn muốn xóa câu lạc bộ <strong>{clubToDelete.name}</strong> không? Các vận động viên thuộc câu lạc bộ này sẽ tạm thời không bị ảnh hưởng nhưng tên của đội vẫn sẽ giữ nguyên.
            </p>

            <div className="flex gap-2.5 justify-end font-sans mt-2">
              <button
                type="button"
                onClick={() => setClubToDelete(null)}
                className="px-3 py-1.5 border border-slate-205 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteVscSystemClub(clubToDelete.id).catch(err => console.error("Failed to delete global club:", err));
                  setClubs((prev) => prev.filter((c) => c.id !== clubToDelete.id));
                  setClubToDelete(null);
                  setNotification({ type: "success", message: `Đã xóa câu lạc bộ thành công!` });
                  setTimeout(() => setNotification(null), 3000);
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

      {/* Athlete Deletion Confirmation Modal */}
      {athleteToDelete && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
          onClick={() => setAthleteToDelete(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-800 animate-scaleUp p-6 flex flex-col gap-4 text-slate-800 dark:text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-50 dark:bg-rose-950/30 rounded-full">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-101 uppercase tracking-wide">Xác nhận xóa Vận động viên?</h3>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
              Bạn có chắc chắn muốn xóa vĩnh viễn hồ sơ và điểm số của VĐV <strong>{athleteToDelete.name}</strong> không? Hành động này không thể khôi phục.
            </p>

            <div className="flex gap-2.5 justify-end font-sans mt-2">
              <button
                type="button"
                onClick={() => setAthleteToDelete(null)}
                className="px-3 py-1.5 border border-slate-205 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  setAthletes(prev => prev.filter(a => a.id !== athleteToDelete.id));
                  setCurrentActiveAthletes(prev => prev.filter(a => a.id !== athleteToDelete.id));
                  if (selectedAthlete && selectedAthlete.id === athleteToDelete.id) {
                    setSelectedAthlete(null);
                  }
                  setIsEditing(false);
                  setIsCreating(false);
                  setAthleteToDelete(null);
                  setNotification({ type: "success", message: `Đã xóa hồ sơ VĐV thành công!` });
                  setTimeout(() => setNotification(null), 3000);
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

      {/* Roster List Deletion Confirmation Modal */}
      {listToDelete && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
          onClick={() => setListToDelete(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-800 animate-scaleUp p-6 flex flex-col gap-4 text-slate-800 dark:text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-50 dark:bg-rose-950/30 rounded-full">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-101 uppercase tracking-wide">Xóa danh sách lưu trữ?</h3>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
              Bạn có chắc chắn muốn xóa danh sách lưu trữ <strong>{listToDelete.name}</strong> không? Các VĐV hiện hữu đang tham gia giải đấu sẽ không bị ảnh hưởng.
            </p>

            <div className="flex gap-2.5 justify-end font-sans mt-2">
              <button
                type="button"
                onClick={() => setListToDelete(null)}
                className="px-3 py-1.5 border border-slate-205 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  setStoredAthleteLists(prev => prev.filter(l => l.id !== listToDelete.id));
                  setListToDelete(null);
                  setNotification({
                    type: "success",
                    message: `Đã xóa danh sách lưu trữ "${listToDelete.name}" thành công!`
                  });
                  setTimeout(() => setNotification(null), 3000);
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

      {/* POPUP MODAL OVERLAY WRAPPER FOR CREATION, EDITING AND VIEWING DETAILED FILES */}
      {(isCreating || isEditing || selectedAthlete) && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn"
          onClick={() => {
            setIsCreating(false);
            setSelectedAthlete(null);
            setIsEditing(false);
            setIsConfirmingDelete(false);
          }}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto border border-slate-210 dark:border-slate-800 animate-scaleUp relative p-5 sm:p-7 flex flex-col gap-4 text-slate-800 dark:text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close Button for convenient mobile touch */}
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setSelectedAthlete(null);
                setIsEditing(false);
                setIsConfirmingDelete(false);
              }}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-650 dark:hover:text-slate-202 hover:bg-slate-105 dark:hover:bg-slate-800 transition-all z-20 cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5 font-bold" />
            </button>

            {/* NESTED CONTENT FORM OR VIEW CARD */}
            {(isCreating || isEditing) ? (
              <form 
                onSubmit={handleSave}
                className="flex flex-col gap-5 mt-2"
              >
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4.5 h-4.5 text-blue-600" />
                {isCreating ? "Thêm Hồ Sơ Vận Động Viên Mới" : "Cập Nhật Chi Tiết Hồ Sơ"}
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(false);
                  }}
                  className="p-1 px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-xs font-semibold flex items-center gap-1 transition-all"
                >
                  <X className="w-3 h-3" /> Hủy bỏ
                </button>
              </div>
            </div>

            {validationError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-xl text-xs font-semibold leading-relaxed shadow-sm animate-fadeIn flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <span className="text-base leading-none">⚠️</span>
                  <div className="flex-1">{validationError}</div>
                </div>
                {duplicateSysMatch && !isVscTab && (
                  <div className="mt-1 pt-2 border-t border-rose-200 dark:border-rose-800/60 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      👉 Gợi ý: Nạp trực tiếp VĐV <strong>"{duplicateSysMatch.name}"</strong> (ID: {duplicateSysMatch.id}) vào giải đấu:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        handleAddVscToTournament(duplicateSysMatch);
                        setIsCreating(false);
                        setDuplicateSysMatch(null);
                        setValidationError("");
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow transition-all cursor-pointer hover:scale-105 active:scale-95"
                    >
                      <PlusCircle className="w-4 h-4" /> Thêm ngay VĐV này vào giải
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Avatar section selection */}
              <div className="flex flex-col items-center text-center gap-3 md:border-r md:pr-4 border-gray-100">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Hình ảnh đại diện</span>
                
                <div className="relative group cursor-pointer w-24 h-24 rounded-full overflow-hidden border-2 border-blue-500 shadow-md shrink-0 flex items-center justify-center bg-slate-50">
                  <img 
                    src={formAvatarUrl || AVATAR_MALE} 
                    alt="Preview" 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <label className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[10px] font-bold">
                    <Camera className="w-4 h-4 mb-0.5" />
                    Tải ảnh lên
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
                              compressImage(reader.result).then((compressed) => {
                                setFormAvatarUrl(compressed);
                              });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="w-full">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 text-[11px] text-blue-600 hover:text-blue-800 font-bold bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded transition-colors">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Chọn ảnh từ thiết bị</span>
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
                              compressImage(reader.result).then((compressed) => {
                                setFormAvatarUrl(compressed);
                              });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="w-full mt-1">
                  <span className="text-[10px] text-gray-400 block mb-1">
                    Hoặc nhập URL ảnh phía dưới:
                  </span>
                  <input
                    type="text"
                    value={formAvatarUrl}
                    onChange={(e) => setFormAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full px-2 py-1 text-[11px] bg-slate-50 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Preset Avatar Selection */}
                <span className="text-[10px] text-gray-400 block mt-3 mb-1">
                  Chọn ảnh mẫu trống (Nam/Nữ):
                </span>
                <div className="flex gap-4 justify-center w-full mt-1">
                  {PRESET_AVATARS.map((url, i) => {
                    const isMale = i === 0;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setFormAvatarUrl(url)}
                        className={`relative rounded-xl p-2 flex flex-col items-center gap-1 border transition-all w-24 ${
                          formAvatarUrl === url 
                            ? "border-blue-500 bg-blue-50 text-blue-700 font-bold" 
                            : "border-slate-250 hover:bg-slate-50 text-slate-500"
                        }`}
                      >
                        <img 
                          src={url} 
                          alt={isMale ? "Nam" : "Nữ"} 
                          referrerPolicy="no-referrer" 
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm" 
                        />
                        <span className="text-[10px] font-semibold">{isMale ? "Trống Nam" : "Trống Nữ"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Form Input fields */}
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* ID code */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1">
                    Mã số VĐV (ID): <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formId}
                    onChange={(e) => {
                      setFormId(e.target.value);
                      setValidationError("");
                      setDuplicateSysMatch(null);
                    }}
                    placeholder="e.g. 0004"
                    className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold"
                  />
                  {(() => {
                    if (!formId.trim()) return null;
                    const trimmedId = formId.trim().toLowerCase();
                    const liveSys = vscSystemAthletes.find(
                      (a) => a.id.trim().toLowerCase() === trimmedId && (!selectedAthlete || selectedAthlete.id.trim().toLowerCase() !== a.id.trim().toLowerCase())
                    );
                    const liveRoster = currentRoster.find(
                      (a) => a.id.trim().toLowerCase() === trimmedId && (!selectedAthlete || selectedAthlete.id.trim().toLowerCase() !== a.id.trim().toLowerCase())
                    );
                    const liveActive = (currentActiveAthletes || []).find(
                      (a) => a.id.trim().toLowerCase() === trimmedId && (!selectedAthlete || selectedAthlete.id.trim().toLowerCase() !== a.id.trim().toLowerCase())
                    );

                    if (isCreating && liveSys && !isVscTab) {
                      return (
                        <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 rounded-lg text-[11px] text-amber-900 dark:text-amber-200 flex flex-col gap-1.5 shadow-sm">
                          <div>
                            ⚠️ ID <strong>"{liveSys.id}"</strong> trùng với VĐV <strong>"{liveSys.name}"</strong> ({liveSys.team || "Chưa có CLB"}) trên Hệ thống VSC.
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              handleAddVscToTournament(liveSys);
                              setIsCreating(false);
                              setDuplicateSysMatch(null);
                              setValidationError("");
                            }}
                            className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 shadow"
                          >
                            <PlusCircle className="w-3.5 h-3.5" /> Nạp VĐV "{liveSys.name}" vào giải ngay
                          </button>
                        </div>
                      );
                    }

                    if (isCreating && liveSys && isVscTab) {
                      return (
                        <p className="mt-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                          ⚠️ Mã ID này đã thuộc về VĐV "{liveSys.name}" trên Hệ thống VSC. Vui lòng đổi ID khác.
                        </p>
                      );
                    }

                    if (isCreating && !liveSys && (liveRoster || liveActive)) {
                      const matchName = (liveRoster || liveActive)?.name;
                      return (
                        <p className="mt-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                          ⚠️ Mã ID này đã thuộc về VĐV "{matchName}" trong danh sách giải đấu. Vui lòng đổi ID khác.
                        </p>
                      );
                    }

                    if (isEditing && selectedAthlete && selectedAthlete.id.trim().toLowerCase() !== trimmedId && (liveSys || liveRoster || liveActive)) {
                      const matchName = (liveSys || liveRoster || liveActive)?.name;
                      return (
                        <p className="mt-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                          ⚠️ Mã ID này đã thuộc về VĐV "{matchName}". Vui lòng đổi ID khác.
                        </p>
                      );
                    }

                    return null;
                  })()}
                </div>

                {/* Full name */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1">
                    Họ và Tên: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                  />
                </div>

                {/* Email liên kết (Tra cứu Cloud) */}
                <div className="col-span-1 sm:col-span-2 bg-slate-100/50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Email tài khoản Cloud (Tùy chọn):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="vdv_clb@gmail.com"
                      className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleLoadCloudProfile(formEmail)}
                      className="px-3 bg-indigo-55 hover:bg-indigo-600 text-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-indigo-200 animate-pulse" /> Tra cứu Cloud
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Nếu vận động viên đã có hồ sơ cá nhân trên Cloud, nhấp <strong>"Tra cứu Cloud"</strong> để tự động điền nhanh toàn bộ ảnh đại diện, số CCCD, ngày sinh, địa chỉ, tỉnh thành và câu lạc bộ!
                  </p>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">
                    Giới tính:
                  </label>
                  <select
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>

                {/* Team CLB */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">
                    Câu lạc bộ / Đội tuyển:
                  </label>
                  {clubs.length === 0 ? (
                    <div className="text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-2.5 flex flex-col gap-1.5 font-sans leading-relaxed">
                      <span>⚠️ Chưa có câu lạc bộ nào trong danh sách.</span>
                      <button
                        type="button"
                        onClick={() => {
                          setLeftTab("clubs");
                          setIsCreating(false);
                          setIsEditing(false);
                          setSelectedAthlete(null);
                        }}
                        className="text-left text-indigo-600 dark:text-indigo-400 hover:underline font-extrabold cursor-pointer"
                      >
                        Nhấp vào đây để sang thẻ Câu Lạc Bộ tạo trước!
                      </button>
                    </div>
                  ) : (
                    <select
                      value={formTeam}
                      onChange={(e) => setFormTeam(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-extrabold text-slate-800 dark:text-slate-100"
                    >
                      <option value="">-- Chọn Câu lạc bộ --</option>
                      {clubs.map(c => (
                        <option key={c.id} value={c.name}>
                          {c.name} {c.province ? `(${c.province})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="mt-1.5 flex items-center">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-indigo-800 bg-indigo-50/70 dark:bg-slate-900/40 border border-indigo-150 py-1 px-2 rounded-lg leading-none select-none">
                      <input
                        type="checkbox"
                        checked={formIsPrimaryTeam}
                        onChange={(e) => setFormIsPrimaryTeam(e.target.checked)}
                        className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>Bắn chính cho Đội/CLB</span>
                    </label>
                  </div>
                </div>

                {/* ID Card / Passport */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">
                    Căn cước / Hộ chiếu:
                  </label>
                  <input
                    type="text"
                    value={formIdCard}
                    onChange={(e) => setFormIdCard(e.target.value)}
                    placeholder="Số CMND/CCCD/Passport"
                    className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>

                {/* DOB */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">
                    Ngày tháng năm sinh:
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      value={formDob}
                      onChange={(e) => setFormDob(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Hometown */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">
                    Quê quán / Nguyên quán:
                  </label>
                  <input
                    type="text"
                    value={formHometown}
                    onChange={(e) => setFormHometown(e.target.value)}
                    placeholder="Trực Ninh, Nam Định"
                    className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Province / City */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">
                    Tỉnh / Thành phố hiện tại:
                  </label>
                  <input
                    type="text"
                    value={formProvince}
                    onChange={(e) => setFormProvince(e.target.value)}
                    placeholder="Nam Định"
                    className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Country with mini flag selector */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1">
                    Quốc gia: {getCountryEmoji(formCountryCode)}
                  </label>
                  <select
                    value={formCountryCode}
                    onChange={handleCountryChange}
                    className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {PRESET_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.emoji} {c.name}
                      </option>
                    ))}
                  </select>

                  {formCountryCode === "OTHER" && (
                    <div className="mt-2 animate-fadeIn">
                      <label className="block text-[10px] text-gray-400 mb-1 font-semibold">
                        Tự nhập tên quốc gia:
                      </label>
                      <input
                        type="text"
                        value={formCountry}
                        onChange={(e) => setFormCountry(e.target.value)}
                        placeholder="e.g. Vương quốc Anh, Canada..."
                        required
                        className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-blue-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                      />
                    </div>
                  )}
                </div>

                {/* Attendance Status */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1">
                    Trạng thái điểm danh:
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                  >
                    <option value="Thi đấu">Thi đấu</option>
                    <option value="Bỏ thi">Bỏ thi</option>
                  </select>
                </div>

              </div>

            </div>

            {/* Bottom Actions Form */}
            <div className="pt-4 border-t border-gray-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setIsEditing(false);
                }}
                className="py-1.5 px-4 border border-gray-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="py-1.5 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" /> 
                {isCreating ? "Đăng ký vận động viên" : "Lưu Thay Đổi"}
              </button>
            </div>
          </form>
        ) : selectedAthlete ? (
          /* Profile Detail View card - clean elegant display */
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-6">
            
            {/* Core Header with Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-3">
              <div className="flex items-center gap-4">
                <img 
                  src={selectedAthlete.avatarUrl || AVATAR_MALE} 
                  alt={selectedAthlete.name} 
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-full object-cover border-2 border-indigo-100 shadow-md shrink-0"
                />

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      ID: {selectedAthlete.id}
                    </span>
                    <span className="text-sm bg-slate-50 text-slate-500 font-mono">
                      {getCountryEmoji(selectedAthlete.countryCode)} {selectedAthlete.country || "Việt Nam"}
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-1">
                    {selectedAthlete.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium flex items-center gap-2">
                    <span>{selectedAthlete.team ? `Đơn vị: ${selectedAthlete.team}` : "Vận động viên tự do"}</span>
                    <span className="text-gray-300">•</span>
                    <span>Giới tính: <strong className="font-bold text-slate-700">{selectedAthlete.gender || "Nam"}</strong></span>
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 ml-auto sm:ml-0 self-end sm:self-center">
                {isConfirmingDelete ? (
                  <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 p-1 px-1.5 rounded-lg animate-fadeIn text-[11px] font-bold text-rose-800">
                    <span className="uppercase tracking-wider mr-1 text-[10px]">Xác nhận xóa?</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (isVscTab) {
                          updateVscSystemAthletesAndKeepSync(vscSystemAthletes.filter((a) => a.id !== selectedAthlete.id));
                        } else {
                          setAthletes((prev) => prev.filter((a) => a.id !== selectedAthlete.id));
                          setCurrentActiveAthletes((prev) => prev.filter((a) => a.id !== selectedAthlete.id));
                        }
                        setSelectedAthlete(null);
                        setIsEditing(false);
                        setIsCreating(false);
                        setIsConfirmingDelete(false);
                      }}
                      className="py-1 px-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-black cursor-pointer leading-none transition-colors"
                    >
                      {language === "en" ? "Delete" : "Xóa"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(false)}
                      className="py-1 px-2.5 bg-gray-200 hover:bg-gray-300 text-slate-700 rounded text-[11px] font-bold cursor-pointer leading-none transition-colors"
                    >
                      {language === "en" ? "Cancel" : "Hủy"}
                    </button>
                  </div>
                ) : (
                  <>
                    {isVscTab && (
                      <button
                        type="button"
                        onClick={() => handleAddVscToTournament(selectedAthlete)}
                        className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                        title={language === "en" ? "Add this athlete to the current active tournament roster" : "Thêm VĐV này vào danh sách giải thi đấu hiện tại"}
                      >
                        <PlusCircle className="w-3.5 h-3.5" /> {language === "en" ? "Add to Active" : "Thêm vào giải hiện hành"}
                      </button>
                    )}
                    
                    <button
                      type="button"
                      onClick={() => handleStartEdit(selectedAthlete)}
                      className="py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 border border-indigo-150 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> {language === "en" ? "Edit Profile" : "Chỉnh sửa hồ sơ"}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(true)}
                      className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold flex items-center gap-1 border border-rose-150 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Xóa hồ sơ
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Structured details display */}
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Thông tin chi tiết pháp lý & cá nhân</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                
                {/* ID Card */}
                <div className="flex items-start gap-2.5">
                  <CreditCard className="w-4.5 h-4.5 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">Giấy tờ tùy thân (Căn cước / Passport)</span>
                    <span className="text-sm text-slate-800 font-semibold font-mono">
                      {selectedAthlete.idCard || <span className="text-gray-300 italic font-mono font-normal">Chưa cập nhật</span>}
                    </span>
                  </div>
                </div>

                {/* Day of birth */}
                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4.5 h-4.5 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">Ngày tháng năm sinh</span>
                    <span className="text-sm text-slate-800 font-semibold">
                      {selectedAthlete.dob ? (
                        new Date(selectedAthlete.dob).toLocaleDateString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric"
                        })
                      ) : (
                        <span className="text-gray-300 italic font-normal">Chưa cập nhật</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Hometown */}
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4.5 h-4.5 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">Quê quán (Nguyên quán)</span>
                    <span className="text-sm text-slate-800 font-semibold">
                      {selectedAthlete.hometown || <span className="text-gray-300 italic font-normal">Chưa cập nhật</span>}
                    </span>
                  </div>
                </div>

                 {/* Province / city */}
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4.5 h-4.5 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">Tỉnh / Thành phố đang thi đấu</span>
                    <span className="text-sm text-slate-800 font-semibold">
                      {selectedAthlete.province || <span className="text-gray-300 italic font-normal">Chưa cập nhật</span>}
                    </span>
                  </div>
                </div>

                {/* Attendance Status */}
                <div className="flex items-start gap-2.5">
                  <UserCheck className="w-4.5 h-4.5 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">Trạng thái điểm danh</span>
                    <span className={`text-sm font-bold inline-block rounded ${
                      selectedAthlete.status === "Bỏ thi" 
                        ? "text-rose-600 bg-rose-50 px-1.5 py-0.5 dark:bg-rose-950/20 dark:text-rose-400" 
                        : "text-emerald-700 bg-emerald-50 px-1.5 py-0.5 dark:bg-emerald-950/20 dark:text-emerald-400"
                    }`}>
                      {selectedAthlete.status || "Thi đấu"}
                    </span>
                  </div>
                </div>

              </div>
            </div>

          </div>
            ) : null}
          </div>
        </div>,
        document.body
      )}

      {/* Hidden legacy visual block */}
      {false && (
        <div className="flex flex-col gap-6">
            
            {/* 1. Saved Athlete Lists Panel */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-indigo-600" />
                    Danh sách VĐV theo Giải đã lưu ({storedAthleteLists?.length || 0})
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Chọn danh sách đã lưu từ các giải trước để áp dụng lại nhanh cho giải đấu đang chơi.
                  </p>
                </div>
              </div>

              {/* Manual Save Current Active Athletes structure as requested */}
              {athletes && athletes.length > 0 && (
                <div className="bg-indigo-50/45 border border-indigo-150 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="text-left w-full sm:w-auto">
                    <span className="text-[11px] font-bold text-indigo-800 flex items-center gap-1 uppercase tracking-wide">
                      <CheckCircle className="w-4 h-4 text-indigo-600" />
                      Giải hiện hành đang có {athletes.length} VĐV trong danh sách
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Bạn có thể lưu danh sách {athletes.length} đấu thủ này thủ công để sử dụng lại bất cứ lúc nào cho giải khác.
                    </p>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto col-span-2">
                    <input
                      type="text"
                      placeholder="Nhập tên lưu (e.g. Giải Bán kết)..."
                      value={customSaveName}
                      onChange={(e) => setCustomSaveName(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold flex-1 sm:flex-none sm:w-48 text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const nameToUse = customSaveName.trim() || matchName;
                        if (!nameToUse) {
                          setNotification({ type: "error", message: "Vui lòng nhập tên cho danh sách lưu trữ!" });
                          setTimeout(() => setNotification(null), 3000);
                          return;
                        }
                        const newListRecord: StoredAthleteList = {
                          id: `list-${Date.now()}`,
                          name: nameToUse,
                          createdAt: new Date().toISOString(),
                          athletes: JSON.parse(JSON.stringify(athletes)),
                        };
                        setStoredAthleteLists((prev) => {
                          const filtered = prev.filter((item) => item.name.toLowerCase() !== nameToUse.toLowerCase());
                          return [newListRecord, ...filtered];
                        });
                        setCustomSaveName("");
                        setNotification({ type: "success", message: `Đã lưu danh sách "${nameToUse}" thành công!` });
                        setTimeout(() => setNotification(null), 4000);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4 py-2 rounded-lg transition-all shadow-sm shrink-0 cursor-pointer"
                    >
                      Lưu Roster
                    </button>
                  </div>
                </div>
              )}

              {/* Stored Lists collection */}
              {!storedAthleteLists || storedAthleteLists.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 dark:bg-slate-950/20 border border-dashed rounded-xl p-6 text-gray-400 text-xs italic">
                  Không có danh sách lưu trữ nào. Các danh sách sẽ tự động được thu lại khi một giải đấu mới được thiết lập.
                </div>
              ) : (
                <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
                  {storedAthleteLists.map((item) => {
                    const isExpanded = expandedListId === item.id;
                    const isConfirmingD = listIdToConfirmDelete === item.id;
                    const isConfirmingA = listIdToConfirmApply === item.id;

                    return (
                      <div 
                        key={item.id}
                        className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-105 flex flex-col gap-3 hover:border-indigo-300 dark:hover:border-indigo-900 transition-all shadow-sm"
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="min-w-0">
                            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-250 block truncate font-sans">
                              {item.name}
                            </span>
                            <span className="text-[10px] text-gray-400 block mt-0.5">
                              Tạo ngày: {new Date(item.createdAt).toLocaleString("vi-VN")} &bull;{" "}
                              <strong className="text-indigo-600 dark:text-indigo-400 font-bold">
                                {item.athletes?.length || 0} vận động viên
                              </strong>
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end">
                            {/* Toggle Preview Expand */}
                            <button
                              type="button"
                              onClick={() => setExpandedListId(isExpanded ? null : item.id)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg transition-all text-xs flex items-center gap-1 font-bold cursor-pointer"
                              title="Xem trước vận động viên trong danh sách"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Xem ({item.athletes?.length || 0})</span>
                            </button>

                            {/* Load / Apply Flow */}
                            {!isConfirmingA ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setListIdToConfirmApply(item.id);
                                  setApplyConfirmStep(1);
                                  setListIdToConfirmDelete(null);
                                }}
                                className="p-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.01] text-white rounded-lg text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer shadow-sm active:scale-95 shadow-emerald-200"
                                title="Tải danh sách này vào danh sách Quản lý VĐV"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Áp dụng</span>
                              </button>
                            ) : applyConfirmStep === 1 ? (
                              <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950 px-2.5 py-1 rounded border border-amber-300">
                                <span className="text-[10px] text-amber-805 dark:text-amber-400 font-bold whitespace-nowrap">
                                  ⚠️ Xác nhận lần 1: Nạp danh sách này?
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setApplyConfirmStep(2)}
                                  className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[9px] cursor-pointer"
                                >
                                  CÓ
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setListIdToConfirmApply(null);
                                    setApplyConfirmStep(0);
                                  }}
                                  className="px-2 py-0.5 bg-gray-250 text-slate-700 rounded font-normal text-[9px] cursor-pointer"
                                >
                                  HỦY
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950 px-2.5 py-1 rounded border border-rose-300">
                                <span className="text-[10px] text-rose-800 dark:text-rose-400 font-bold animate-pulse whitespace-nowrap">
                                  🚨 Xác nhận lần 2: Trận đấu hiện tại sẽ reset danh sách! Tiếp tục?
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Prepare athletes with reset scores matching current distances & shot counts
                                    const applied = item.athletes.map(a => {
                                      const freshScores: Record<string, (boolean | null)[]> = {};
                                      distances.forEach(d => {
                                        freshScores[d.id] = Array(shotsCount).fill(null);
                                      });
                                      return {
                                        ...a,
                                        scores: freshScores
                                      };
                                    });

                                    // Replace master registration list in Quản lý VĐV (which is the prop name "athletes")
                                    setAthletes(applied);

                                    setListIdToConfirmApply(null);
                                    setApplyConfirmStep(0);
                                    setNotification({
                                      type: "success",
                                      message: `Đã nạp thành công ${applied.length} vận động viên vào danh sách Quản lý VĐV!`
                                    });
                                    setTimeout(() => setNotification(null), 4000);
                                  }}
                                  className="px-2 py-0.5 bg-rose-600 text-white rounded font-bold text-[9px] cursor-pointer"
                                >
                                  NẠP NGAY
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setListIdToConfirmApply(null);
                                    setApplyConfirmStep(0);
                                  }}
                                  className="px-2 py-0.5 bg-gray-250 text-slate-700 rounded font-normal text-[9px] cursor-pointer"
                                >
                                  HỦY
                                </button>
                              </div>
                            )}

                            {/* Delete specific stored list Flow */}
                            {!isConfirmingD ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setListIdToConfirmDelete(item.id);
                                  setListIdToConfirmApply(null);
                                }}
                                className="p-1.5 text-rose-650 hover:text-white bg-rose-50 hover:bg-rose-650 rounded-lg transition-all cursor-pointer"
                                title="Xóa danh sách lưu trữ này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950 px-2 py-1 rounded border border-rose-200">
                                <span className="text-[10px] text-rose-800 dark:text-rose-400 font-bold">Xóa?</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStoredAthleteLists(prev => prev.filter(l => l.id !== item.id));
                                    setListIdToConfirmDelete(null);
                                    setNotification({
                                      type: "success",
                                      message: `Đã xóa danh sách lưu trữ "${item.name}"!`
                                    });
                                    setTimeout(() => setNotification(null), 3000);
                                  }}
                                  className="px-1.5 py-0.5 bg-rose-600 text-white rounded font-bold text-[9px] cursor-pointer"
                                >
                                  XÓA
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setListIdToConfirmDelete(null)}
                                  className="px-1.5 py-0.5 bg-gray-250 text-slate-700 rounded font-normal text-[9px] cursor-pointer"
                                >
                                  HỦY
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Expanded Preview display list */}
                        {isExpanded && (
                          <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 rounded-lg animate-fadeIn text-[11px] flex flex-col gap-1 text-slate-600 dark:text-slate-300">
                            <span className="font-bold border-b pb-1 text-gray-500 block mb-1">
                              Thành viên trong lưu trữ ({item.athletes?.length || 0}):
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                              {(item.athletes || []).map((ath, idx) => {
                                if (!ath) return null;
                                return (
                                  <div key={`${ath.id || idx}-${idx}`} className="flex items-center gap-1.5 bg-white dark:bg-slate-950 p-1 px-2 rounded border border-gray-150">
                                    <span className="font-mono text-indigo-600 font-bold">#{idx + 1}</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate flex-1">{ath.name || "Không rõ"}</span>
                                    <span className="text-[9px] text-gray-400">({ath.team || "Tự do"})</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Secondary Informational Card */}
            <div className="bg-slate-50 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 p-8 rounded-2xl text-center flex flex-col justify-center items-center min-h-[160px]">
              <UserCirclePlaceholder />
              <h3 className="text-xs sm:text-sm font-bold text-slate-700 mt-2">Chưa chọn cá nhân VĐV xem hồ sơ</h3>
              <p className="text-[11px] text-gray-500 mt-1 max-w-sm mx-auto leading-normal">
                Vui lòng chọn một vận động viên từ danh sách bên trái để xem đầy đủ hồ sơ chi tiết (avatar, CMND, ngày sinh, quê quán...) hoặc chỉnh sửa hồ sơ pháp lý.
              </p>
            </div>
          </div>
        )}

      {/* Toast Notification for premium interactive feedback */}
      {notification && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-xl flex items-center gap-3 animate-slideIn border ${
          notification.type === "success" 
            ? "bg-emerald-600 dark:bg-emerald-700 text-white border-emerald-500" 
            : "bg-rose-600 dark:bg-rose-700 text-white border-rose-500"
        } max-w-sm`}>
          <div className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
          <span className="text-xs font-bold leading-normal">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="text-white hover:text-gray-200 ml-auto font-black cursor-pointer text-xs">✕</button>
        </div>
      )}

    </div>
  );
};

// Simple visual SVG avatar mockup icon
const UserCirclePlaceholder = () => (
  <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-200 text-slate-350 flex items-center justify-center">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-gray-300">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  </div>
);
