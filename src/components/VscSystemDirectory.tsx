import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../context/LanguageContext";
import { Athlete, MatchHistoryItem } from "../types";
import { 
  subscribeToVscSystemAthletes, 
  saveVscSystemAthletes,
  updateUserProfile
} from "../lib/firebaseService";
import { VIETNAM_PROVINCES } from "../utils/provinces";
import { AthleteProfileModal } from "./AthleteProfileModal";
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  User, 
  Users, 
  MapPin, 
  Calendar, 
  Building, 
  Award, 
  Activity, 
  TrendingUp, 
  X, 
  UserCheck, 
  FileText, 
  Lock,
  ChevronRight,
  Filter,
  RefreshCw,
  Sparkles,
  Info
} from "lucide-react";
import { AVATAR_MALE, AVATAR_FEMALE } from "./AthleteManagement";

const compressImage = (base64Str: string, maxWidth = 180, maxHeight = 180): Promise<string> => {
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

interface VscSystemDirectoryProps {
  currentUser: any;
  userRole: string;
  history: MatchHistoryItem[];
  onlineTournaments?: any[];
  onOpenAuthModal: () => void;
}

export const VscSystemDirectory: React.FC<VscSystemDirectoryProps> = ({
  currentUser,
  userRole,
  history,
  onlineTournaments = [],
  onOpenAuthModal
}) => {
  const { language } = useLanguage();
  const [systemAthletes, setSystemAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProvince, setSelectedProvince] = useState("all");
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [selectedGender, setSelectedGender] = useState("all");

  // Selected athlete for profile view / biography drawer
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);

  // Create/Edit form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [targetAthleteId, setTargetAthleteId] = useState<string | null>(null);
  const [deletingAthleteId, setDeletingAthleteId] = useState<string | null>(null);

  // Form fields
  const [formName, setFormName] = useState("");
  const [formId, setFormId] = useState("");
  const [formTeam, setFormTeam] = useState("");
  const [formGender, setFormGender] = useState("Nam");
  const [formIdCard, setFormIdCard] = useState("");
  const [formDob, setFormDob] = useState("");
  const [formHometown, setFormHometown] = useState("");
  const [formProvince, setFormProvince] = useState("");
  const [formAvatarUrl, setFormAvatarUrl] = useState(AVATAR_MALE);
  const [formEmail, setFormEmail] = useState("");
  const [formValidationError, setFormValidationError] = useState("");
  const [isCompressingAvatar, setIsCompressingAvatar] = useState(false);

  const isNameEditDisabled = useMemo(() => {
    if (formMode !== "edit") return false;
    if (userRole === "admin") return false;
    const originalAthlete = systemAthletes.find(
      (a) => a.id.toLowerCase() === targetAthleteId?.toLowerCase()
    );
    if (!originalAthlete) return false;
    return !!(originalAthlete.nameEditCount && originalAthlete.nameEditCount >= 1);
  }, [formMode, userRole, systemAthletes, targetAthleteId]);

  // Subscriptions
  useEffect(() => {
    // Prevent body background scroll when any directory modal is open
    if (selectedAthlete || isFormOpen || deletingAthleteId) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedAthlete, isFormOpen, deletingAthleteId]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    setLoading(true);
    try {
      unsubscribe = subscribeToVscSystemAthletes((remoteAthletes) => {
        if (remoteAthletes) {
          // Sort system athletes alphabetically by name
          const sorted = [...remoteAthletes].sort((a, b) => a.name.localeCompare(b.name, "vi"));
          setSystemAthletes(sorted);
        }
        setLoading(false);
      });
    } catch (err) {
      console.error("VSC system athletes subscription failed:", err);
      setLoading(false);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Determine if the logged-in user already has a linked profile in the system
  const myLinkedProfile = useMemo(() => {
    if (!currentUser || !currentUser.email) return null;
    return systemAthletes.find(
      (a) => a.email && a.email.trim().toLowerCase() === currentUser.email.trim().toLowerCase()
    ) || null;
  }, [currentUser, systemAthletes]);

  // Extract unique provinces & clubs for filtering
  const filterOptions = useMemo(() => {
    const provinces = new Set<string>();
    const teams = new Set<string>();

    systemAthletes.forEach((a) => {
      if (a.province && a.province.trim()) provinces.add(a.province.trim());
      if (a.team && a.team.trim()) teams.add(a.team.trim());
    });

    return {
      provinces: Array.from(provinces).sort((a, b) => a.localeCompare(b, "vi")),
      teams: Array.from(teams).sort((a, b) => a.localeCompare(b, "vi")),
    };
  }, [systemAthletes]);

  // Filtered system athletes
  const filteredAthletes = useMemo(() => {
    return systemAthletes.filter((a) => {
      const matchSearch = 
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.team && a.team.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (a.province && a.province.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchProvince = selectedProvince === "all" || a.province === selectedProvince;
      const matchTeam = selectedTeam === "all" || a.team === selectedTeam;
      const matchGender = selectedGender === "all" || a.gender === selectedGender;

      return matchSearch && matchProvince && matchTeam && matchGender;
    });
  }, [systemAthletes, searchTerm, selectedProvince, selectedTeam, selectedGender]);

  // Generate unique sequential VSC ID: VSC-0001 to VSC-9999
  const generateNextVscId = () => {
    let nextIdNum = 1;
    const existingIds = new Set(systemAthletes.map((a) => a.id.trim().toLowerCase()));

    while (
      existingIds.has(`vsc-${nextIdNum.toString().padStart(4, "0")}`) ||
      existingIds.has(nextIdNum.toString().padStart(4, "0"))
    ) {
      nextIdNum++;
    }
    return `VSC-${nextIdNum.toString().padStart(4, "0")}`;
  };

  // Open creation form (standard user can only create for their own email)
  const openCreateForm = () => {
    setFormMode("create");
    setFormValidationError("");
    
    // Auto generate ID
    const nextId = generateNextVscId();
    setFormId(nextId);
    
    setFormName(currentUser?.displayName || "");
    setFormTeam("");
    setFormGender("Nam");
    setFormIdCard("");
    setFormDob("");
    setFormHometown("");
    setFormProvince("");
    setFormAvatarUrl(AVATAR_MALE);
    setFormEmail(currentUser?.email || "");
    setTargetAthleteId(null);
    setIsFormOpen(true);
  };

  // Open edit form
  const openEditForm = (athlete: Athlete) => {
    setFormMode("edit");
    setFormValidationError("");
    setFormId(athlete.id);
    setFormName(athlete.name);
    setFormTeam(athlete.team);
    setFormGender(athlete.gender || "Nam");
    setFormIdCard(athlete.idCard || "");
    setFormDob(athlete.dob || "");
    setFormHometown(athlete.hometown || "");
    setFormProvince(athlete.province || "");
    setFormAvatarUrl(athlete.avatarUrl || AVATAR_MALE);
    setFormEmail(athlete.email || "");
    setTargetAthleteId(athlete.id);
    setIsFormOpen(true);
  };

  // Save profile (handles create & edit)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormValidationError("");

    if (!formName.trim()) {
      setFormValidationError(language === "en" ? "Please fill in athlete's name." : "Vui lòng điền họ tên vận động viên.");
      return;
    }

    if (!formId.trim()) {
      setFormValidationError(language === "en" ? "Please enter VSC ID." : "Vui lòng nhập Mã số VSC.");
      return;
    }

    const trimmedId = formId.trim();
    const isEditingMatch = formMode === "edit" && targetAthleteId;

    // Check for ID duplicates
    const duplicatedAthlete = systemAthletes.find(
      (a) => a.id.trim().toLowerCase() === trimmedId.toLowerCase() && 
             (!isEditingMatch || targetAthleteId.toLowerCase() !== a.id.trim().toLowerCase())
    );

    if (duplicatedAthlete) {
      setFormValidationError(
        language === "en" 
          ? `⚠️ ID "${trimmedId}" is already registered by ${duplicatedAthlete.name}.` 
          : `⚠️ Mã số VSC "${trimmedId}" đã được đăng ký cho VĐV "${duplicatedAthlete.name}".`
      );
      return;
    }

    // Anti-spam & email verification for standard users
    if (userRole !== "admin") {
      // Must link to their own email
      if (!currentUser || !currentUser.email) {
        setFormValidationError(language === "en" ? "You must be logged in." : "Bạn cần đăng nhập để tiếp tục.");
        return;
      }
      if (formEmail.trim().toLowerCase() !== currentUser.email.trim().toLowerCase()) {
        setFormValidationError(language === "en" ? "Profile must match your account email." : "Hồ sơ VĐV bắt buộc phải liên kết với Email tài khoản của bạn.");
        return;
      }

      // If creating, check if they already have one matching email to prevent multi-profile spam
      const emailDup = systemAthletes.find(
        (a) => a.email && a.email.trim().toLowerCase() === currentUser.email.trim().toLowerCase() &&
               (!isEditingMatch || targetAthleteId.toLowerCase() !== a.id.trim().toLowerCase())
      );
      if (emailDup) {
        setFormValidationError(
          language === "en" 
            ? `⚠️ You already have a VSC Profile with ID "${emailDup.id}".` 
            : `⚠️ Tài khoản của bạn đã được liên kết với hồ sơ VĐV mang mã "${emailDup.id}". Mỗi tài khoản chỉ được tạo 1 hồ sơ duy nhất.`
        );
        return;
      }
    }

    const originalAthlete = isEditingMatch && targetAthleteId
      ? systemAthletes.find((a) => a.id.toLowerCase() === targetAthleteId.toLowerCase())
      : null;

    let finalNameEditCount = 0;
    if (originalAthlete) {
      const isNameChanged = formName.trim() !== originalAthlete.name.trim();
      if (isNameChanged) {
        if (userRole !== "admin" && originalAthlete.nameEditCount && originalAthlete.nameEditCount >= 1) {
          setFormValidationError(
            language === "en"
              ? "⚠️ You have already edited your full name once. Please contact an admin for further adjustments."
              : "⚠️ Bạn đã sử dụng hết lượt thay đổi họ tên (tối đa 1 lần). Vui lòng liên hệ Admin để hỗ trợ."
          );
          return;
        }
        finalNameEditCount = (originalAthlete.nameEditCount || 0) + 1;
      } else {
        finalNameEditCount = originalAthlete.nameEditCount || 0;
      }
    }

    // Ensure avatar image is compressed before saving to avoid payload limit
    let finalAvatarUrl = formAvatarUrl;
    if (finalAvatarUrl && finalAvatarUrl.startsWith("data:image")) {
      try {
        finalAvatarUrl = await compressImage(finalAvatarUrl, 180, 180);
      } catch (e) {
        console.warn("Avatar compression before save skipped:", e);
      }
    }

    // Build saved athlete object
    const updatedAthlete: Athlete = {
      id: trimmedId,
      name: formName.trim(),
      team: formTeam.trim() || (language === "en" ? "Independent" : "Tự do"),
      gender: formGender,
      idCard: formIdCard.trim(),
      dob: formDob,
      hometown: formHometown.trim(),
      province: formProvince.trim(),
      country: "Việt Nam",
      countryCode: "VN",
      avatarUrl: finalAvatarUrl,
      email: formEmail.trim().toLowerCase(),
      status: "Thi đấu",
      scores: {}, // Empty baseline scores for system profile template
      nameEditCount: finalNameEditCount
    };

    let newSystemList = [...systemAthletes];
    if (formMode === "create") {
      newSystemList.push(updatedAthlete);
    } else {
      newSystemList = newSystemList.map((a) => 
        a.id.toLowerCase() === targetAthleteId?.toLowerCase() ? updatedAthlete : a
      );
    }

    try {
      await saveVscSystemAthletes(newSystemList);

      // Sync with Control Panel User Profile if the email belongs to the current user
      if (currentUser && currentUser.email && updatedAthlete.email.trim().toLowerCase() === currentUser.email.trim().toLowerCase()) {
        try {
          await updateUserProfile(currentUser.uid, {
            displayName: updatedAthlete.name,
            cccd: updatedAthlete.idCard,
            birthDate: updatedAthlete.dob,
            address: updatedAthlete.hometown,
            province: updatedAthlete.province,
            club: updatedAthlete.team,
            avatarUrl: updatedAthlete.avatarUrl
          });
        } catch (syncErr) {
          console.warn("Failed to sync profile back to Control Panel user doc:", syncErr);
        }
      }

      setIsFormOpen(false);
      // If editing currently viewed biography, update it too
      if (selectedAthlete && selectedAthlete.id.toLowerCase() === updatedAthlete.id.toLowerCase()) {
        setSelectedAthlete(updatedAthlete);
      }
    } catch (err) {
      console.error("Save system athletes failed:", err);
      setFormValidationError(language === "en" ? "Failed to save profile. Please try again." : "Lưu hồ sơ thất bại. Vui lòng thử lại.");
    }
  };

  // Trigger delete confirmation (Admins only)
  const handleDeleteProfile = (athleteId: string) => {
    if (userRole !== "admin") return;
    setDeletingAthleteId(athleteId);
  };

  // Execute actual deletion (Admins only)
  const executeDeleteProfile = async () => {
    if (userRole !== "admin" || !deletingAthleteId) return;
    const newList = systemAthletes.filter((a) => a.id.toLowerCase() !== deletingAthleteId.toLowerCase());
    try {
      await saveVscSystemAthletes(newList);
      if (selectedAthlete && selectedAthlete.id.toLowerCase() === deletingAthleteId.toLowerCase()) {
        setSelectedAthlete(null);
      }
      setDeletingAthleteId(null);
    } catch (err) {
      console.error("Failed to delete system athlete:", err);
    }
  };

  // Calculate detailed historical tournament statistics for an athlete
  const athleteStats = useMemo(() => {
    if (!selectedAthlete) return null;
    const athleteIdLower = selectedAthlete.id.trim().toLowerCase();
    const athleteNameLower = selectedAthlete.name.trim().toLowerCase();
    const athleteEmailLower = selectedAthlete.email?.trim().toLowerCase() || "";

    // Gather all matching participations across online tournaments
    const participations: {
      matchName: string;
      date: string;
      totalShots: number;
      totalHits: number;
      hitRate: number;
      rank: number;
    }[] = [];

    let totalMatchShots = 0;
    let totalMatchHits = 0;
    let highestRank = 9999;

    const getTournamentDateString = (tour: any, lang: string) => {
      if (tour.date) return tour.date;
      if (tour.startDate) return tour.startDate;
      if (tour.createdAt) {
        try {
          const dateObj = typeof tour.createdAt.toDate === "function" 
            ? tour.createdAt.toDate() 
            : (tour.createdAt.seconds ? new Date(tour.createdAt.seconds * 1000) : new Date(tour.createdAt));
          return dateObj.toLocaleDateString(lang === "en" ? "en-US" : "vi-VN");
        } catch (e) {
          return "---";
        }
      }
      return "---";
    };

    const seenMatchKeys = new Set<string>();
    const allMatches = onlineTournaments || [];

    allMatches.forEach((match) => {
      if (!match) return;
      const matchDateStr = getTournamentDateString(match, language || "vi");
      const compositeKey = `${match.id || ""}-${match.matchName || ""}-${matchDateStr}`.trim().toLowerCase();
      if (seenMatchKeys.has(compositeKey)) return;
      seenMatchKeys.add(compositeKey);

      const soloList = match.athletes || [];
      const teamList = match.teamAthletes || [];
      const masterSoloList = match.masterAthletes || [];
      const masterTeamList = match.teamMasterAthletes || [];

      const findAthlete = (list: any[]) => {
        return list.find((a: any) => {
          const idMatch = a.id && a.id.trim().toLowerCase() === athleteIdLower;
          const emailMatch = athleteEmailLower && a.email && a.email.trim().toLowerCase() === athleteEmailLower;
          return idMatch || emailMatch;
        });
      };

      const foundSolo = findAthlete(soloList);
      const foundTeam = findAthlete(teamList);
      const foundMasterSolo = findAthlete(masterSoloList);
      const foundMasterTeam = findAthlete(masterTeamList);

      const targetAthleteData = foundSolo || foundTeam || foundMasterSolo || foundMasterTeam;

      if (targetAthleteData) {
        // Calculate shots and hits in this tournament
        let matchShots = 0;
        let matchHits = 0;

        // Count scores
        if (targetAthleteData.scores) {
          Object.values(targetAthleteData.scores).forEach((scoreArr) => {
            if (Array.isArray(scoreArr)) {
              matchShots += scoreArr.length;
              matchHits += scoreArr.filter((h) => h === true).length;
            }
          });
        }

        // Calculate rank in this tournament
        let rank = 1;
        let rankPool: any[] = [];
        if (foundSolo) rankPool = soloList;
        else if (foundTeam) rankPool = teamList;
        else if (foundMasterSolo) rankPool = masterSoloList;
        else if (foundMasterTeam) rankPool = masterTeamList;

        const sortedScores = rankPool
          .map((ath: any) => {
            let hits = 0;
            if (ath.scores) {
              Object.values(ath.scores).forEach((arr: any) => {
                if (Array.isArray(arr)) {
                  hits += arr.filter((h) => h === true).length;
                }
              });
            }
            return { id: ath.id, name: ath.name, hits };
          })
          .sort((a: any, b: any) => b.hits - a.hits);

        const matchRankIdx = sortedScores.findIndex(
          (x: any) => x.id.trim().toLowerCase() === targetAthleteData.id.trim().toLowerCase()
        );
        if (matchRankIdx !== -1) {
          rank = matchRankIdx + 1;
        }

        if (rank < highestRank) {
          highestRank = rank;
        }

        totalMatchShots += matchShots;
        totalMatchHits += matchHits;

        participations.push({
          matchName: match.matchName,
          date: matchDateStr,
          totalShots: matchShots,
          totalHits: matchHits,
          hitRate: matchShots > 0 ? Math.round((matchHits / matchShots) * 100) : 0,
          rank
        });
      }
    });

    const overallHitRate = totalMatchShots > 0 ? Math.round((totalMatchHits / totalMatchShots) * 100) : 0;

    return {
      participations: participations.sort((a, b) => b.date.localeCompare(a.date)),
      totalTournaments: participations.length,
      totalShots: totalMatchShots,
      totalHits: totalMatchHits,
      overallHitRate,
      highestRank: highestRank === 9999 ? null : highestRank
    };
  }, [selectedAthlete, onlineTournaments, language]);

  // Image upload handling with compression (prevents Firestore payload size limit errors)
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setFormValidationError(
        language === "en" 
          ? "Image file is too large (maximum 15MB)." 
          : "Tệp ảnh quá lớn (tối đa 15MB)."
      );
      return;
    }

    setIsCompressingAvatar(true);
    setFormValidationError("");

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rawBase64 = event.target?.result as string;
        const compressedBase64 = await compressImage(rawBase64, 180, 180);
        setFormAvatarUrl(compressedBase64);
      } catch (err) {
        console.error("Failed to compress avatar:", err);
        setFormValidationError(
          language === "en" ? "Failed to process image file." : "Không thể xử lý tệp ảnh này."
        );
      } finally {
        setIsCompressingAvatar(false);
      }
    };
    reader.onerror = () => {
      setIsCompressingAvatar(false);
      setFormValidationError(
        language === "en" ? "Error reading image file." : "Lỗi khi đọc tệp ảnh."
      );
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-full flex flex-col gap-6" id="vsc-system-directory-root">
      
      {/* 1. Portal Heading & Brand Intro */}
      <div className="bg-gradient-to-br from-[#9c0c13] to-[#80090e] text-white rounded-2xl p-6 shadow-lg border border-red-800 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 shrink-0 select-none pointer-events-none transform translate-x-12 -translate-y-8">
          <Users className="w-96 h-96" />
        </div>
        <div className="space-y-2 relative z-10 text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-[10px] uppercase font-black tracking-wider text-yellow-300 border border-white/15">
            <Sparkles className="w-3.5 h-3.5" />
            VSC National Database
          </div>
          <h2 className="text-xl md:text-2xl font-black italic tracking-tight uppercase">
            {language === "en" ? "VSC System Athletes Registry" : "Danh Sách VĐV Hệ Thống Quốc Gia"}
          </h2>
          <p className="text-xs md:text-sm text-red-100 max-w-2xl leading-relaxed">
            {language === "en" 
              ? "Official verified database of professional slingshot competitors. Each profile preserves long-term records, match statistics, and personal biography histories."
              : "Cơ sở dữ liệu chính thức lưu giữ chỉ số chuyên môn, định mức phân cấp và hồ sơ thành tích thi đấu của toàn bộ các vận động viên Ná cao su chuyên nghiệp VSC Việt Nam."}
          </p>
        </div>

        {/* Action controls */}
        <div className="shrink-0 flex flex-wrap gap-3 relative z-10">
          {currentUser ? (
            !myLinkedProfile ? (
              <button
                onClick={openCreateForm}
                className="bg-yellow-400 hover:bg-yellow-450 text-slate-900 font-extrabold text-xs px-5 py-3 rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer border border-yellow-500 uppercase tracking-wider"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                {language === "en" ? "Register My Profile" : "Tạo Hồ Sơ Của Tôi"}
              </button>
            ) : (
              <div className="bg-white/10 border border-white/15 rounded-xl p-3 flex items-center gap-3 text-left">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                  <UserCheck className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-[10px] text-yellow-300 font-extrabold uppercase">ĐÃ LIÊN KẾT HỒ SƠ VSC</div>
                  <div className="text-xs font-bold truncate max-w-[150px]">{myLinkedProfile.name}</div>
                </div>
                <button
                  onClick={() => openEditForm(myLinkedProfile)}
                  className="bg-white/10 hover:bg-white/20 p-1.5 rounded-lg text-white transition-all cursor-pointer border border-white/10 ml-2"
                  title="Chỉnh sửa hồ sơ của tôi"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="bg-white hover:bg-slate-50 text-[#9c0c13] font-extrabold text-xs px-5 py-3 rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer border border-white uppercase tracking-wider"
            >
              <Lock className="w-4 h-4" />
              {language === "en" ? "Sign In to Create Profile" : "Đăng Nhập Để Tạo Hồ Sơ"}
            </button>
          )}

          {/* Admin only create other athletes */}
          {userRole === "admin" && (
            <button
              onClick={() => {
                setFormMode("create");
                setFormValidationError("");
                setFormId(generateNextVscId());
                setFormName("");
                setFormTeam("");
                setFormGender("Nam");
                setFormIdCard("");
                setFormDob("");
                setFormHometown("");
                setFormProvince("");
                setFormAvatarUrl(AVATAR_MALE);
                setFormEmail("");
                setTargetAthleteId(null);
                setIsFormOpen(true);
              }}
              className="bg-[#c2141c] hover:bg-red-700 text-white font-extrabold text-xs px-5 py-3 rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer border border-red-500 uppercase tracking-wider"
              title="Admin thêm VĐV Hệ thống bất kỳ"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              {language === "en" ? "Add Athlete (Admin)" : "Thêm VĐV Hệ Thống"}
            </button>
          )}
        </div>
      </div>

      {/* 2. Highlight: My Profile Card if exists */}
      {currentUser && myLinkedProfile && (
        <div className="bg-emerald-50/70 dark:bg-emerald-950/10 border border-emerald-150 dark:border-emerald-900/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
          <div className="flex items-center gap-4.5">
            <div className="relative shrink-0">
              <img 
                src={myLinkedProfile.avatarUrl || AVATAR_MALE} 
                alt="My Profile avatar" 
                className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500 bg-white shadow-sm"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-0 right-0 bg-emerald-500 text-white p-1 rounded-full text-[9px] shadow-sm border border-white">
                <UserCheck className="w-3 h-3" />
              </span>
            </div>
            <div>
              <div className="inline-flex items-center gap-1 bg-emerald-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full mb-1">
                Hồ sơ VSC của bạn
              </div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                {myLinkedProfile.name}
                <span className="text-xs font-black text-emerald-650 bg-emerald-100/50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md border border-emerald-200">
                  {myLinkedProfile.id}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {myLinkedProfile.team || (language === "en" ? "Independent" : "Tự do")} • {myLinkedProfile.province || (language === "en" ? "No Province" : "Chưa có tỉnh thành")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => setSelectedAthlete(myLinkedProfile)}
              className="flex-1 sm:flex-initial bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 border border-slate-250 dark:border-slate-800 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Activity className="w-4 h-4 text-emerald-500" />
              {language === "en" ? "View My Stats" : "Thành tích của tôi"}
            </button>
            <button
              onClick={() => openEditForm(myLinkedProfile)}
              className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Edit2 className="w-4 h-4" />
              {language === "en" ? "Edit Profile" : "Cập nhật thông tin"}
            </button>
          </div>
        </div>
      )}

      {/* 3. Search and Filters Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-150 dark:border-slate-800/80 shadow-sm flex flex-col gap-4 text-left">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-extrabold text-xs uppercase tracking-wider">
          <Filter className="w-4 h-4 text-[#9c0c13]" />
          {language === "en" ? "Search & Filter Database" : "Bộ lọc tìm kiếm vận động viên"}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === "en" ? "Search by name, ID, club..." : "Tìm tên, ID, CLB, Tỉnh..."}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/60 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#9c0c13]/30 focus:border-[#9c0c13] transition-all"
            />
          </div>

          {/* Gender Filter */}
          <div>
            <select
              value={selectedGender}
              onChange={(e) => setSelectedGender(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#9c0c13]/30 focus:border-[#9c0c13] transition-all"
            >
              <option value="all">🚻 {language === "en" ? "All Genders" : "Tất Cả Giới Tính"}</option>
              <option value="Nam">♂️ {language === "en" ? "Male" : "Nam"}</option>
              <option value="Nữ">♀️ {language === "en" ? "Female" : "Nữ"}</option>
            </select>
          </div>

          {/* Province Filter */}
          <div>
            <select
              value={selectedProvince}
              onChange={(e) => setSelectedProvince(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#9c0c13]/30 focus:border-[#9c0c13] transition-all"
            >
              <option value="all">📍 {language === "en" ? "All Provinces" : "Tất Cả Tỉnh Thành"}</option>
              {filterOptions.provinces.map((prov) => (
                <option key={prov} value={prov}>{prov}</option>
              ))}
            </select>
          </div>

          {/* Club Filter */}
          <div>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#9c0c13]/30 focus:border-[#9c0c13] transition-all"
            >
              <option value="all">🛡️ {language === "en" ? "All Clubs" : "Tất Cả Câu Lạc Bộ"}</option>
              {filterOptions.teams.map((team) => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dynamic record count badge */}
        <div className="text-slate-400 text-[10px] font-extrabold flex items-center justify-between">
          <div>
            Hệ thống hiển thị: <span className="text-[#9c0c13] font-black">{filteredAthletes.length}</span> / {systemAthletes.length} VĐV
          </div>
          {(searchTerm || selectedProvince !== "all" || selectedTeam !== "all" || selectedGender !== "all") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedProvince("all");
                setSelectedTeam("all");
                setSelectedGender("all");
              }}
              className="text-[#9c0c13] hover:underline font-black cursor-pointer uppercase text-[9px]"
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* 4. Main Grid List of Athletes */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl py-20 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-4">
          <RefreshCw className="w-8 h-8 text-[#9c0c13] animate-spin" />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {language === "en" ? "Loading national athlete database..." : "Đang tải dữ liệu hồ sơ vận động viên..."}
          </p>
        </div>
      ) : filteredAthletes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl py-16 px-4 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center max-w-xl mx-auto gap-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-full text-slate-400">
            <Users className="w-12 h-12" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
              Không tìm thấy vận động viên phù hợp
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs leading-normal">
              Thử đổi từ khóa tìm kiếm khác hoặc đặt lại bộ lọc để tìm kiếm rộng hơn.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" id="vsc-athlete-grid">
          {filteredAthletes.map((athlete) => {
            const isMine = currentUser && athlete.email && athlete.email.trim().toLowerCase() === currentUser.email.trim().toLowerCase();
            return (
              <div
                key={athlete.id}
                onClick={() => setSelectedAthlete(athlete)}
                className={`bg-white dark:bg-slate-900 rounded-2xl p-4.5 border transition-all duration-200 flex flex-col text-left cursor-pointer group hover:shadow-md hover:scale-[1.02] ${
                  isMine 
                    ? "border-emerald-250 dark:border-emerald-850 bg-gradient-to-br from-white to-emerald-50/10 dark:from-slate-900 dark:to-emerald-950/5 shadow-sm"
                    : "border-slate-150 dark:border-slate-800/80 hover:border-[#9c0c13]/30"
                }`}
              >
                {/* Card Top Header */}
                <div className="flex items-center gap-3 mb-3.5">
                  <div className="relative shrink-0">
                    <img 
                      src={athlete.avatarUrl || AVATAR_MALE} 
                      alt={athlete.name} 
                      className={`w-12 h-12 rounded-full object-cover bg-slate-50 border shadow-inner ${
                        isMine ? "border-emerald-400" : "border-slate-100 dark:border-slate-800"
                      }`}
                      referrerPolicy="no-referrer"
                    />
                    <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border border-white flex items-center justify-center text-[7px] text-white ${
                      athlete.gender === "Nữ" ? "bg-pink-500" : "bg-blue-500"
                    }`}>
                      {athlete.gender === "Nữ" ? "♀" : "♂"}
                    </span>
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold flex items-center gap-1">
                      <span className="font-black text-[#9c0c13] dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-1.5 py-0.5 rounded text-[9px] border border-red-100 dark:border-red-900/30">
                        {athlete.id}
                      </span>
                    </div>
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 truncate group-hover:text-[#9c0c13] transition-colors mt-1">
                      {athlete.name}
                    </h4>
                  </div>
                </div>

                {/* Details Section */}
                <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800/60 pt-3 pb-3.5 flex-1">
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                    <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{athlete.team || (language === "en" ? "Independent" : "Tự do")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{athlete.province || (language === "en" ? "National" : "Chưa cập nhật")}</span>
                  </div>
                  {athlete.dob && (
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                      <Calendar className="w-3.5 h-3.5 text-slate-350 shrink-0" />
                      <span>{athlete.dob}</span>
                    </div>
                  )}
                </div>

                {/* Footer Action of card */}
                <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-800/30 pt-2.5">
                  <span className="text-[9px] font-black uppercase text-slate-400 group-hover:text-[#9c0c13] flex items-center gap-0.5 transition-colors">
                    Hồ sơ chi tiết
                    <ChevronRight className="w-3 h-3" />
                  </span>

                  {/* Actions for Admins/Self */}
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {(userRole === "admin" || isMine) && (
                      <button
                        onClick={() => openEditForm(athlete)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-[#9c0c13] transition-all cursor-pointer"
                        title="Chỉnh sửa hồ sơ"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    )}
                    {userRole === "admin" && (
                      <button
                        onClick={() => handleDeleteProfile(athlete.id)}
                        className="p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg text-rose-500 hover:text-rose-650 transition-all cursor-pointer"
                        title="Xóa hồ sơ (Chỉ Admin)"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Biography Modal Drawer / Full Details */}
      <AthleteProfileModal
        athlete={selectedAthlete}
        isOpen={!!selectedAthlete}
        onClose={() => setSelectedAthlete(null)}
        history={history}
        onlineTournaments={onlineTournaments}
        currentUser={currentUser}
        isGlobalAdmin={userRole === "admin"}
        language={language}
      />

      {/* 6. Form Modal Overlay: Create / Edit VSC Profile */}
      {isFormOpen && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-fadeIn text-slate-800 dark:text-slate-100" 
          id="profile-form-overlay"
          onClick={() => setIsFormOpen(false)}
        >
          <div 
            className="relative my-auto bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl z-20 border border-slate-200 dark:border-slate-800 flex flex-col text-left overflow-hidden max-h-[85vh] shrink-0 animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Form Header */}
            <div className="bg-[#9c0c13] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-yellow-300" />
                <h3 className="text-sm font-black uppercase tracking-wider text-yellow-300">
                  {formMode === "create" ? (language === "en" ? "Register VSC Profile" : "Đăng ký hồ sơ VSC") : (language === "en" ? "Edit VSC Profile" : "Cập nhật hồ sơ VSC")}
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-white hover:bg-white/10 p-1.5 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveProfile} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                {formValidationError && (
                  <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-bold p-3 rounded-xl border border-rose-100 dark:border-rose-900/30">
                    {formValidationError}
                  </div>
                )}

                {/* ID and Email (Locked fields for standard users) */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-900">
                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-450 mb-1">Mã VĐV (Hệ thống)</label>
                    <input
                      type="text"
                      value={formId}
                      onChange={(e) => userRole === "admin" && setFormId(e.target.value)}
                      disabled={userRole !== "admin"}
                      className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs font-black text-slate-850 dark:text-slate-100 focus:outline-none disabled:opacity-70"
                      placeholder="VSC-XXXX"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-450 mb-1">Email liên kết</label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => userRole === "admin" && setFormEmail(e.target.value)}
                      disabled={userRole !== "admin"}
                      className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs font-bold text-slate-850 dark:text-slate-100 focus:outline-none disabled:opacity-70 truncate"
                      placeholder="email@vscs.asia"
                    />
                  </div>
                </div>

                {/* Personal details fields */}
                <div className="space-y-3">
                  {/* Full name */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-450 mb-1">Họ và Tên <span className="text-[#9c0c13]">*</span></label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => !isNameEditDisabled && setFormName(e.target.value)}
                      required
                      disabled={isNameEditDisabled}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#9c0c13]/30 focus:border-[#9c0c13] disabled:bg-slate-100 dark:disabled:bg-slate-900/50 disabled:opacity-75 disabled:cursor-not-allowed"
                      placeholder="Nguyễn Văn A"
                    />
                    {isNameEditDisabled && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-500 font-bold mt-1">
                        ⚠️ {language === "en" ? "You have already edited your name once. Please contact an Admin for further changes." : "Bạn đã sử dụng hết lượt tự đổi tên (tối đa 1 lần). Vui lòng liên hệ Ban trọng tài/Admin nếu cần sửa đổi thêm."}
                      </p>
                    )}
                  </div>

                  {/* Club / Team */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-450 mb-1">Câu lạc bộ (Đơn vị)</label>
                    <input
                      type="text"
                      value={formTeam}
                      onChange={(e) => setFormTeam(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#9c0c13]/30 focus:border-[#9c0c13]"
                      placeholder="Ví dụ: 36 Slingshot Club"
                    />
                  </div>

                  {/* Gender, DOB */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-slate-450 mb-1">Giới tính</label>
                      <select
                        value={formGender}
                        onChange={(e) => setFormGender(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#9c0c13]/30 focus:border-[#9c0c13]"
                      >
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-slate-450 mb-1">Ngày sinh</label>
                      <input
                        type="date"
                        value={formDob}
                        onChange={(e) => setFormDob(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#9c0c13]/30 focus:border-[#9c0c13]"
                      />
                    </div>
                  </div>

                  {/* Province, Hometown */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-slate-450 mb-1">Tỉnh thành</label>
                      <select
                        value={formProvince && !VIETNAM_PROVINCES.includes(formProvince) ? "Khác" : formProvince}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "Khác") {
                            setFormProvince("Nước Ngoài");
                          } else {
                            setFormProvince(val);
                          }
                        }}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#9c0c13]/30 focus:border-[#9c0c13]"
                      >
                        <option value="">-- Chọn Tỉnh / Thành phố --</option>
                        {VIETNAM_PROVINCES.map((prov) => (
                          <option key={prov} value={prov}>{prov}</option>
                        ))}
                        <option value="Khác">Khác (Tự nhập)</option>
                      </select>
                      {(formProvince === "Khác" || (formProvince && !VIETNAM_PROVINCES.includes(formProvince))) && (
                        <input
                          type="text"
                          value={formProvince === "Khác" ? "" : formProvince}
                          onChange={(e) => setFormProvince(e.target.value)}
                          placeholder="Nhập tỉnh thành khác..."
                          className="mt-1.5 w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#9c0c13]/30 focus:border-[#9c0c13]"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-slate-450 mb-1">Quê quán</label>
                      <input
                        type="text"
                        value={formHometown}
                        onChange={(e) => setFormHometown(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#9c0c13]/30 focus:border-[#9c0c13]"
                        placeholder="Quảng Xương, Thanh Hóa..."
                      />
                    </div>
                  </div>

                  {/* CCCD ID Card for secure tournament registry */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-450 mb-1">Số CCCD / CMT (Bảo mật - chỉ dùng xác thực thi đấu)</label>
                    <input
                      type="text"
                      value={formIdCard}
                      onChange={(e) => setFormIdCard(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#9c0c13]/30 focus:border-[#9c0c13]"
                      placeholder="Ví dụ: 038012345678"
                    />
                  </div>

                  {/* Custom Profile Avatar Image Selection */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-450 mb-2">Ảnh đại diện</label>
                    <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-900">
                      <img 
                        src={formAvatarUrl} 
                        alt="Avatar preview" 
                        className="w-14 h-14 rounded-full object-cover border-2 border-red-500 shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setFormAvatarUrl(AVATAR_MALE)}
                            className={`px-3 py-1 text-[10px] font-extrabold rounded-lg border transition-all cursor-pointer ${
                              formAvatarUrl === AVATAR_MALE 
                                ? "bg-[#9c0c13] border-[#9c0c13] text-white" 
                                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                            }`}
                          >
                            ♂️ Mặc định Nam
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormAvatarUrl(AVATAR_FEMALE)}
                            className={`px-3 py-1 text-[10px] font-extrabold rounded-lg border transition-all cursor-pointer ${
                              formAvatarUrl === AVATAR_FEMALE 
                                ? "bg-pink-500 border-pink-500 text-white" 
                                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                            }`}
                          >
                            ♀️ Mặc định Nữ
                          </button>
                        </div>
                        
                        {/* Image Upload Input */}
                        <label className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg text-center cursor-pointer shadow-xs max-w-[170px] inline-flex items-center justify-center gap-1.5">
                          {isCompressingAvatar ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin text-[#9c0c13]" />
                              <span>{language === "en" ? "Compressing..." : "Đang nén..."}</span>
                            </>
                          ) : (
                            <>
                              📁 {language === "en" ? "Upload avatar..." : "Tải ảnh lên..."}
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarFileChange}
                            disabled={isCompressingAvatar}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons (Pinned Footer) */}
              <div className="flex gap-3 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-850 p-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer text-center"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#9c0c13] hover:bg-red-750 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer text-center shadow-md border border-red-750"
                >
                  Lưu hồ sơ
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {deletingAthleteId && typeof document !== "undefined" && createPortal(
        (() => {
          const deletingAthlete = systemAthletes.find(a => a.id.toLowerCase() === deletingAthleteId.toLowerCase());
          return (
            <div 
              className="fixed inset-0 z-[99999] flex flex-col items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto transition-opacity animate-fadeIn text-slate-800 dark:text-slate-100"
              onClick={() => setDeletingAthleteId(null)}
            >
              <div 
                className="relative my-auto w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden p-5 sm:p-6 scale-100 shrink-0 animate-scaleIn z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 text-rose-600 dark:text-rose-500 mb-4">
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/20 rounded-xl">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      {language === "en" ? "Delete VSC System Profile" : "Xác nhận xóa Hồ sơ VĐV Hệ Thống"}
                    </h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                      {language === "en" ? "Irreversible Action" : "Hành động nguy hiểm không thể hoàn tác"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    {language === "en" 
                      ? `Are you sure you want to permanently delete the official system profile of athlete `
                      : `Bạn có chắc chắn muốn xóa vĩnh viễn hồ sơ VĐV Hệ Thống chính thức của `}
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      {deletingAthlete?.name || deletingAthleteId}
                    </span>{" "}
                    ({deletingAthleteId})?
                  </p>
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl p-3">
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 font-bold leading-relaxed">
                      ⚠️ {language === "en"
                        ? "All bio history, match logs, and stats linked with this profile on the National VSC system will be permanently purged."
                        : "Toàn bộ lịch sử hoạt động, thành tích thi đấu và thống kê liên quan của VĐV này trên hệ thống VSC quốc gia sẽ bị xóa vĩnh viễn khỏi cơ sở dữ liệu."}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setDeletingAthleteId(null)}
                    className="flex-1 bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer text-center"
                  >
                    {language === "en" ? "Cancel" : "Hủy bỏ"}
                  </button>
                  <button
                    type="button"
                    onClick={executeDeleteProfile}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer text-center shadow-md border border-rose-700"
                  >
                    {language === "en" ? "Delete Permanently" : "Xóa vĩnh viễn"}
                  </button>
                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}

    </div>
  );
};
