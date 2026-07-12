import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { 
  subscribeToTournamentsList, 
  deleteOnlineTournament,
  getUserProfile,
  updateUserProfile,
  TournamentData 
} from "../lib/firebaseService";
import { auth } from "../firebase";
import { 
  Trophy, 
  Users, 
  Calendar, 
  Search, 
  User, 
  Award, 
  Trash2, 
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  LogIn,
  SlidersHorizontal,
  Inbox,
  AlertTriangle,
  UserCheck,
  CreditCard,
  MapPin,
  Building,
  Image as ImageIcon,
  Save,
  CheckCircle,
  HelpCircle,
  Clock
} from "lucide-react";
import { Athlete, DistanceConfig } from "../types";
import { getHitCount } from "../utils/qualification";

interface ControlPanelProps {
  onSelectTournament: (id: string, tournament: TournamentData) => void;
  activeHistoryId: string | null;
  onOpenAuthModal: () => void;
  forceSubTab?: "profile" | "created" | "referee";
}

const getTournamentModeLabel = (tour: TournamentData): string => {
  if (tour.tournamentType === "combined") {
    return "Cá Nhân & Đồng Đội (Kết hợp)";
  } else if (tour.tournamentType === "team") {
    return "Hỏa lực Đồng Đội";
  } else if (tour.tournamentType === "individual") {
    return "Hỏa lực Cá Nhân";
  }
  return tour.competitionMode === "team" ? "Hỏa lực Đồng Đội" : "Hỏa lực Cá Nhân";
};

export const ControlPanel: React.FC<ControlPanelProps> = ({
  onSelectTournament,
  activeHistoryId,
  onOpenAuthModal,
  forceSubTab
}) => {
  const [tournaments, setTournaments] = useState<TournamentData[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [showConfirmDeleteId, setShowConfirmDeleteId] = useState<string | null>(null);
  
  // Tab can be profile (hồ sơ của tôi), created (giải tôi tạo), referee (giải tôi trọng tài)
  const [subTab, setSubTab] = useState<"profile" | "created" | "referee">("profile");

  // Sync subtab if forceSubTab changes
  useEffect(() => {
    if (forceSubTab) {
      setSubTab(forceSubTab);
    }
  }, [forceSubTab]);

  // Profile management state
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Profile fields state
  const [dispName, setDispName] = useState("");
  const [idCard, setIdCard] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [address, setAddress] = useState("");
  const [province, setProvince] = useState("");
  const [clubName, setClubName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Track Auth changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Fetch /users/{uid} document on load or user shifts
  useEffect(() => {
    if (!currentUser) {
      setProfile(null);
      return;
    }
    const loadProfile = async () => {
      setProfileLoading(true);
      try {
        const fetched = await getUserProfile(currentUser.uid);
        if (fetched) {
          setProfile(fetched);
          setDispName(fetched.displayName || fetched.email?.split("@")[0] || "");
          setIdCard(fetched.cccd || "");
          setBirthDate(fetched.birthDate || "");
          setAddress(fetched.address || "");
          setProvince(fetched.province || "");
          setClubName(fetched.club || "");
          setAvatarUrl(fetched.avatarUrl || fetched.photoURL || "");
        } else {
          // Fallback init profile
          const defName = currentUser.email ? currentUser.email.split("@")[0] : "Người dùng";
          setDispName(defName);
          setAvatarUrl(currentUser.photoURL || "");
        }
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        setProfileLoading(false);
      }
    };
    loadProfile();
  }, [currentUser]);

  // Subscribe to tournaments live database
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToTournamentsList((list) => {
      setTournaments(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Filter tournaments by search
  const filteredTournaments = useMemo(() => {
    if (!search.trim()) return tournaments;
    const query = search.toLowerCase();
    return tournaments.filter(t => t.matchName.toLowerCase().includes(query));
  }, [tournaments, search]);

  // Created & co-administered tournaments
  const myCreatedTournaments = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.email === "nahnatofficial@gmail.com") return filteredTournaments;
    const email = currentUser.email?.toLowerCase().trim() || "";
    return filteredTournaments.filter(
      t => t.creatorId === currentUser.uid || 
           t.creatorEmail === currentUser.email ||
           (t.subAdmins && t.subAdmins.some(subEmail => subEmail.toLowerCase().trim() === email))
    );
  }, [filteredTournaments, currentUser]);

  // Referee tournaments
  const myRefereeTournaments = useMemo(() => {
    if (!currentUser || !currentUser.email) return [];
    const email = currentUser.email.toLowerCase().trim();
    return filteredTournaments.filter(
      t => t.referees && t.referees.some(refEmail => refEmail.toLowerCase().trim() === email)
    );
  }, [filteredTournaments, currentUser]);

  // Compute 30 days display name restriction countdown
  const nameCooldownInfo = useMemo(() => {
    if (!profile?.lastDisplayNameUpdate) {
      return { canChange: true, daysRemaining: 0 };
    }
    const lastUpdateDate = new Date(profile.lastDisplayNameUpdate);
    const now = new Date();
    const diffTime = now.getTime() - lastUpdateDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      canChange: diffDays >= 30,
      daysRemaining: 30 - diffDays,
      lastDateStr: lastUpdateDate.toLocaleDateString("vi-VN")
    };
  }, [profile]);

  // Real scan tracking athlete achievements across all parsed Match lists
  const myAchievements = useMemo(() => {
    if (!currentUser || !currentUser.email) return [];
    const myEmail = currentUser.email.toLowerCase().trim();
    
    interface AchievementItem {
      tourId: string;
      matchName: string;
      mode: string;
      dateStr: string;
      rank: number;
      score: number;
      totalAthletes: number;
    }

    const resultsList: AchievementItem[] = [];

    // Filter cloud tournaments where this user email is registered as vđv
    tournaments.forEach(tour => {
      const isTeam = tour.competitionMode === "team";
      const athletesList = (isTeam ? tour.teamAthletes : tour.athletes) || [];
      const distancesList = (isTeam ? tour.teamDistances : tour.distances) || [];

      const foundMe = athletesList.find(a => a.email && a.email.toLowerCase().trim() === myEmail);
      if (foundMe) {
        const activeAthletes = athletesList.filter(a => a.status !== "Bỏ thi");
        const playersWithScores = activeAthletes.map(p => {
          let totalScore = 0;
          distancesList.forEach(dist => {
            const hits = p.scores?.[dist.id] || [];
            const hitCount = getHitCount(hits);
            totalScore += hitCount * dist.multiplier;
          });
          return { id: p.id, name: p.name, score: totalScore };
        });

        playersWithScores.sort((a, b) => b.score - a.score);
        
        let rank = 1;
        const myIdx = playersWithScores.findIndex(p => p.id === foundMe.id);
        if (myIdx !== -1) {
          rank = myIdx + 1;
        }

        const dateStr = tour.createdAt && typeof tour.createdAt.toDate === "function"
          ? tour.createdAt.toDate().toLocaleDateString("vi-VN")
          : "Gần đây";

        resultsList.push({
          tourId: tour.id,
          matchName: tour.matchName,
          mode: isTeam ? "Đồng Đội" : "Cá Nhân",
          dateStr,
          rank,
          score: playersWithScores[myIdx]?.score || 0,
          totalAthletes: activeAthletes.length
        });
      }
    });

    return resultsList;
  }, [tournaments, currentUser]);

  // Helper score summaries
  const getTopAthletes = (athletesList: Athlete[], distancesList: DistanceConfig[]): { name: string; score: number }[] => {
    if (!athletesList || athletesList.length === 0) return [];
    const activeList = athletesList.filter(a => a.status !== "Bỏ thi");
    const computed = activeList.map(athlete => {
      let totalScore = 0;
      distancesList.forEach(dist => {
        const hits = athlete.scores?.[dist.id] || [];
        const hitCount = getHitCount(hits);
        totalScore += hitCount * dist.multiplier;
      });
      return { name: athlete.name, score: totalScore };
    });
    return computed.sort((a, b) => b.score - a.score).slice(0, 3);
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!dispName.trim()) {
      alert("Họ và tên hiển thị không được để trống!");
      return;
    }

    setSavingProfile(true);
    try {
      const originalName = profile?.displayName || currentUser.email?.split("@")[0] || "";
      const isNameChanged = dispName.trim().toLowerCase() !== originalName.trim().toLowerCase();

      const payload: any = {
        cccd: idCard.trim(),
        birthDate,
        address: address.trim(),
        province: province.trim(),
        club: clubName.trim(),
        avatarUrl
      };

      if (isNameChanged) {
        if (!nameCooldownInfo.canChange) {
          alert(`Thầy cô/VĐV đổi tên gần đây vào ngày ${nameCooldownInfo.lastDateStr}. Hãy đợi thêm ${nameCooldownInfo.daysRemaining} ngày để đổi tên tiếp theo nhé!`);
          setSavingProfile(false);
          return;
        }
        payload.displayName = dispName.trim();
        payload.lastDisplayNameUpdate = new Date().toISOString();
      }

      await updateUserProfile(currentUser.uid, payload);
      
      // Update local profile representation
      setProfile((prev: any) => ({
        ...prev,
        ...payload,
        email: currentUser.email
      }));

      alert("Cập nhật thông tin profile Vận động viên thành công!");
    } catch (err) {
      console.error(err);
      alert("Đã xảy ra lỗi cập nhật cơ sở dữ liệu. Vui lòng kết nối lại!");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteOnlineTournament(id);
      setShowConfirmDeleteId(null);
    } catch (err) {
      console.error(err);
      alert("Không thể xóa giải đấu này. Bạn không phải trưởng giải hoặc không có quyền!");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-2 text-slate-800 dark:text-slate-100 font-sans">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b border-slate-205 dark:border-slate-800/80 pb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-indigo-650 dark:text-indigo-400" /> BẢNG ĐIỀU KHIỂN CÁ NHÂN (CONTROL PANEL)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
            Nơi tập trung theo dõi các giải đấu trực tuyến do chính thầy cô kiến tạo, hoặc các giải đấu mà thầy cô làm Trọng tài phân công.
          </p>
        </div>

        {currentUser && (
          <div className="flex items-center gap-2.5 bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 rounded-xl px-3 py-1.5 shrink-0 select-none">
            {currentUser.photoURL ? (
              <img src={currentUser.photoURL} alt="avatar" className="w-5 h-5 rounded-full pointer-events-none" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold uppercase pointer-events-none">
                {currentUser.email ? currentUser.email[0] : "U"}
              </div>
            )}
            <span className="text-xs font-bold text-slate-700 dark:text-slate-350">{currentUser.email}</span>
          </div>
        )}
      </div>

      {!currentUser ? (
        /* Call to Action for Auth */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/90 p-8 text-center max-w-xl mx-auto flex flex-col items-center gap-5 my-8 shadow-sm">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl">
            <LogIn className="w-10 h-10 text-indigo-600 dark:text-indigo-400 animate-pulse" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className="text-base sm:text-lg font-extrabold text-slate-905 dark:text-white">
              Yêu cầu đăng nhập tài khoản Cloud
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">
              Vui lòng kết nối với tài khoản Google để sử dụng Bảng Điều Khiển này. Hệ thống sẽ tự động quét và lọc ra toàn bộ giải đấu do bạn khởi tạo hoặc được phân bổ làm trọng tài đám mây.
            </p>
          </div>
          <button
            onClick={onOpenAuthModal}
            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer mt-1"
          >
            Đăng nhập bằng Google Account
          </button>
        </div>
      ) : (
        /* Connected user dashboard panel */
        <div className="flex flex-col gap-5">
          
          {/* Sub Navigation Tabs */}
          <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-100/70 dark:bg-slate-950/40 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 gap-3">
            <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
              <button
                onClick={() => setSubTab("profile")}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  subTab === "profile"
                    ? "bg-white dark:bg-slate-800 shadow-xs text-indigo-700 dark:text-indigo-400 border border-slate-200/40 dark:border-slate-700/40"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                }`}
              >
                <UserCheck className="w-4 h-4" />
                Hồ Sơ VĐV của Tôi
              </button>
              <button
                onClick={() => setSubTab("created")}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  subTab === "created"
                    ? "bg-white dark:bg-slate-800 shadow-xs text-indigo-700 dark:text-indigo-400 border border-slate-200/40 dark:border-slate-700/40"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Giải tôi tạo ({myCreatedTournaments.length})
              </button>
              <button
                onClick={() => setSubTab("referee")}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  subTab === "referee"
                    ? "bg-white dark:bg-slate-800 shadow-xs text-amber-750 dark:text-amber-400 border border-slate-200/40 dark:border-slate-700/40"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                }`}
              >
                <Award className="w-4 h-4" />
                Giải tôi làm Trọng tài ({myRefereeTournaments.length})
              </button>
            </div>

            {/* Quick search (Only show when viewing tournament lists) */}
            {subTab !== "profile" && (
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Lọc tên giải đấu..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 transition-all text-slate-800 dark:text-slate-100"
                />
              </div>
            )}
          </div>

          {/* List display */}
          {loading ? (
            <div className="p-12 text-center flex flex-col justify-center items-center gap-2">
              <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin"></div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Đang tải dữ liệu Cloud...</span>
            </div>
          ) : (
            <>
              {subTab === "profile" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                  {/* Left Column: Form Profile */}
                  <form onSubmit={handleSaveProfile} className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/85 dark:border-slate-800 p-6 flex flex-col gap-5 shadow-xs">
                    <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-850 pb-3">
                      <User className="w-5 h-5 text-indigo-650 dark:text-indigo-400" /> THÔNG TIN HỒ SƠ VẬN ĐỘNG VIÊN LIÊN KẾT
                    </h3>

                    {profileLoading ? (
                      <div className="py-20 text-center flex flex-col justify-center items-center gap-2">
                        <div className="w-7 h-7 rounded-full border-2 border-slate-250 border-t-indigo-550 animate-spin"></div>
                        <span className="text-xs text-slate-400">Đang đồng bộ hồ sơ đám mây...</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col sm:flex-row gap-6 items-center border-b border-slate-100 dark:border-slate-805 pb-5">
                          {/* Avatar preview and uploader */}
                          <div className="flex flex-col items-center gap-2.5">
                            <div className="relative w-24 h-24 rounded-full border border-slate-200 dark:border-slate-850 shadow-inner overflow-hidden bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                              {avatarUrl ? (
                                <img src={avatarUrl} alt="Avatar VĐV" className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-12 h-12 text-slate-300" />
                              )}
                            </div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-950 dark:hover:bg-slate-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 transition-all active:scale-95">
                              <ImageIcon className="w-3.5 h-3.5" /> Thay ảnh
                              <input type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
                            </label>
                          </div>

                          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Display Name (restricted) */}
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex justify-between">
                                <span className="flex items-center gap-1">Tên hiển thị VĐV (Đại diện): <span className="text-red-500">*</span></span>
                                {!nameCooldownInfo.canChange && (
                                  <span className="text-amber-600 font-bold normal-case flex items-center gap-0.5">
                                    <Clock className="w-3.5 h-3.5" /> Đổi tiếp sau {nameCooldownInfo.daysRemaining} ngày
                                  </span>
                                )}
                              </label>
                              <input
                                type="text"
                                value={dispName}
                                onChange={(e) => setDispName(e.target.value)}
                                disabled={!nameCooldownInfo.canChange}
                                placeholder="Nguyễn Văn A"
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-955 disabled:bg-slate-100/50 dark:disabled:bg-slate-900 disabled:cursor-not-allowed border border-gray-300 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold text-slate-900 dark:text-white"
                              />
                              <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                                Tên này hiển thị như tên VĐV. Mặc định là phần tiền tố email. <strong>Chỉ tự đổi được 30 ngày một lần</strong> nhằm chống gian lận lịch sử và lưu trữ điểm số.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* CCCD */}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                              Số CCCD / Hộ chiếu (Passport):
                            </label>
                            <input
                              type="text"
                              value={idCard}
                              onChange={(e) => setIdCard(e.target.value)}
                              placeholder="Số căn cước hoặc Passport..."
                              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-955 border border-gray-300 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-900 dark:text-white"
                            />
                          </div>

                          {/* Birthdate */}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                              Ngày tháng năm sinh:
                            </label>
                            <input
                              type="date"
                              value={birthDate}
                              onChange={(e) => setBirthDate(e.target.value)}
                              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-955 border border-gray-300 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white"
                            />
                          </div>

                          {/* Club */}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                              Câu lạc bộ (CLB) / Nhóm:
                            </label>
                            <input
                              type="text"
                              value={clubName}
                              onChange={(e) => setClubName(e.target.value)}
                              placeholder="Nhập tên CLB..."
                              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-955 border border-gray-300 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold text-slate-900 dark:text-white"
                            />
                          </div>

                          {/* Province / State */}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                              Tỉnh / Thành phố:
                            </label>
                            <input
                              type="text"
                              value={province}
                              onChange={(e) => setProvince(e.target.value)}
                              placeholder="Hà Nội, Nam Định..."
                              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-955 border border-gray-300 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white"
                            />
                          </div>

                          {/* Address Contact */}
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                              Địa chỉ cụ thể (Nơi ở hiện tại):
                            </label>
                            <input
                              type="text"
                              value={address}
                              onChange={(e) => setAddress(e.target.value)}
                              placeholder="Số nhà, ngõ/ngách, xã phường..."
                              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-955 border border-gray-300 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>

                        {/* Save submission button */}
                        <div className="flex justify-end gap-3 mt-4 border-t border-slate-100 dark:border-slate-850 pt-4">
                          <button
                            type="submit"
                            disabled={savingProfile}
                            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all active:scale-95"
                          >
                            <Save className="w-4 h-4" />
                            {savingProfile ? "Đang lưu trữ..." : "Lưu hồ sơ VĐV Cloud"}
                          </button>
                        </div>
                      </>
                    )}
                  </form>

                  {/* Right Column: Achievements & Stats */}
                  <div className="flex flex-col gap-6">
                    {/* Achievements Box */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/85 dark:border-slate-800 p-6 flex flex-col gap-4 shadow-xs">
                      <h3 className="text-sm font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-850 pb-3">
                        <Trophy className="w-4 h-4 text-amber-500" /> THÀNH TÍCH ĐIỂM SỐ CLOUD
                      </h3>

                      {myAchievements.length === 0 ? (
                        <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center flex flex-col items-center justify-center gap-2.5 bg-slate-50/20 dark:bg-slate-950/20">
                          <Trophy className="w-6 h-6 text-slate-300 dark:text-slate-700" />
                          <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Chưa có kết quả lưu trữ</h4>
                            <p className="text-[10px] text-slate-400 leading-normal max-w-xs mt-1">
                              Khi ban tổ chức nhập email <strong className="text-indigo-650 dark:text-indigo-400">{currentUser.email}</strong> vào vận động viên tham dự giải đấu, toàn bộ lịch sử điểm số, xếp hạng tranh tài của bạn sẽ hiển thị đầy đủ tại đây!
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          <p className="text-[10px] text-slate-400 mb-1 leading-normal">
                            Báo cáo kết quả thứ hạng chính thức của bạn tại các đấu trường trực tuyến:
                          </p>
                          <div className="max-h-96 overflow-y-auto pr-1 flex flex-col gap-2.5">
                            {myAchievements.map((item, idx) => {
                              const isPodium = item.rank <= 3;
                              const medalColor = item.rank === 1 ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800" :
                                                item.rank === 2 ? "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-705" :
                                                "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/25 dark:text-amber-450 dark:border-amber-900";

                              return (
                                <div key={idx} className="bg-slate-50/50 dark:bg-slate-950/30 rounded-2xl border border-slate-200/50 dark:border-slate-800/70 p-3 flex flex-col gap-2 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                                  <div className="flex justify-between items-start gap-1">
                                    <h4 className="text-[11px] font-black text-slate-900 dark:text-white leading-normal line-clamp-1 flex-1">
                                      {item.matchName}
                                    </h4>
                                    <span className="text-[8px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300 px-1.5 py-0.5 rounded-md self-center">
                                      {item.mode}
                                    </span>
                                  </div>

                                  <div className="flex justify-between items-center border-t border-slate-200/40 dark:border-slate-800/40 pt-2 text-[10px] text-slate-500">
                                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-400" /> {item.dateStr}</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-300">{item.score} Điểm</span>
                                  </div>

                                  <div className="flex items-center justify-between mt-0.5">
                                    <span className="text-[10px] text-slate-400">Xem BXH giải</span>
                                    {isPodium ? (
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-0.5 ${medalColor}`}>
                                        <Award className="w-3.5 h-3.5" /> Hạng {item.rank} / {item.totalAthletes}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold px-2 py-0.5 rounded-full border border-slate-200/30 dark:border-slate-750">
                                        Hạng {item.rank} / {item.totalAthletes}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {subTab === "created" && (
                <div>
                  {myCreatedTournaments.length === 0 ? (
                    <div className="p-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-center flex flex-col items-center justify-center gap-3 bg-slate-50/20 dark:bg-slate-950/10">
                      <Inbox className="w-8 h-8 text-slate-400/80" />
                      <div>
                        <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">Chưa có giải đấu do bạn tạo</h4>
                        <p className="text-[11px] text-slate-400 max-w-xs mt-1 leading-relaxed">
                          Bạn có thể ra <strong>Trang Chủ</strong> để đăng một giải đấu nội bộ hiện tại của mình lên đám mây Cloud để quản lý dễ dàng hơn.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {myCreatedTournaments.map((tour) => {
                        const isTeam = tour.competitionMode === "team";
                        const activeAthletesList = isTeam ? (tour.teamAthletes || []) : (tour.athletes || []);
                        const activeDistancesList = isTeam ? (tour.teamDistances || []) : (tour.distances || []);
                        const topAthletes = getTopAthletes(activeAthletesList, activeDistancesList);
                        const isActive = activeHistoryId === tour.id;

                        const dateStr = tour.createdAt && typeof tour.createdAt.toDate === "function" 
                          ? tour.createdAt.toDate().toLocaleDateString("vi-VN", { hour: "2-digit", minute: "2-digit" }) 
                          : "Gần đây";

                        return (
                          <div
                            key={tour.id}
                            className={`relative bg-white dark:bg-slate-900 rounded-3xl border p-5 flex flex-col gap-4 shadow-xs transition-all ${
                              isActive 
                                ? "border-indigo-500 ring-2 ring-indigo-500/15" 
                                : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                                  <Calendar className="w-3 h-3" /> {dateStr}
                                </span>
                                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 line-clamp-1 mt-0.5">
                                  {tour.matchName}
                                </h3>
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white px-2 py-0.5 rounded-md">
                                QR Trưởng Giải
                              </span>
                            </div>

                            {/* Summary info */}
                            <div className="bg-slate-50 dark:bg-slate-950/40 rounded-2xl p-3 border border-slate-100 dark:border-slate-800/20 text-xs flex flex-col gap-1.5">
                              <div className="flex justify-between items-center text-slate-500">
                                <span>Chế độ: <strong className="text-slate-700 dark:text-slate-300">{getTournamentModeLabel(tour)}</strong></span>
                                <span>VĐV: <strong className="text-slate-700 dark:text-slate-300">{activeAthletesList.length}</strong></span>
                              </div>
                              <div className="flex justify-between items-center text-slate-500 border-t border-slate-200/40 dark:border-slate-800/40 pt-1.5">
                                <span>Trọng tài phụ trợ:</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                  {tour.referees && tour.referees.length > 0 ? `${tour.referees.length} người` : "Chưa chỉ định"}
                                </span>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 justify-end mt-1 border-t border-slate-100 dark:border-slate-800/40 pt-3">
                              <button
                                onClick={() => {
                                  setShowConfirmDeleteId(tour.id);
                                }}
                                className="p-2 text-rose-500 hover:text-white hover:bg-rose-500 border border-rose-200 hover:border-transparent dark:border-rose-950 dark:hover:bg-rose-900 rounded-xl transition-all cursor-pointer text-xs flex items-center gap-1"
                                title="Xóa giải này khỏi Cloud"
                              >
                                <Trash2 className="w-4 h-4" /> Xóa
                              </button>
                              
                              <button
                                onClick={() => onSelectTournament(tour.id, tour)}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                              >
                                Quản lý giải đấu <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {subTab === "referee" && (
                <div>
                  {myRefereeTournaments.length === 0 ? (
                    <div className="p-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-center flex flex-col items-center justify-center gap-3 bg-slate-50/20 dark:bg-slate-950/10">
                      <Award className="w-8 h-8 text-slate-400" />
                      <div>
                        <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">Chưa thấy giải được mời làm Trọng tài</h4>
                        <p className="text-[11px] text-slate-400 max-w-sm mt-1 leading-relaxed">
                          Để được phân quyền làm Trọng Tài phụ trợ nhập điểm trên mây: Hãy nhờ <strong>Trưởng giải</strong> truy cập vào tab <strong>"Cấu Hình"</strong> của giải đó &rarr; kéo xuống phần <strong>"Quản lý trọng tài (Cloud)"</strong> và thêm email <strong className="text-indigo-600 dark:text-indigo-400">{currentUser.email}</strong> của bạn vào đó nhé!
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {myRefereeTournaments.map((tour) => {
                        const isTeam = tour.competitionMode === "team";
                        const activeAthletesList = isTeam ? (tour.teamAthletes || []) : (tour.athletes || []);
                        const activeDistancesList = isTeam ? (tour.teamDistances || []) : (tour.distances || []);
                        const isActive = activeHistoryId === tour.id;

                        const dateStr = tour.createdAt && typeof tour.createdAt.toDate === "function" 
                          ? tour.createdAt.toDate().toLocaleDateString("vi-VN", { hour: "2-digit", minute: "2-digit" }) 
                          : "Gần đây";

                        return (
                          <div
                            key={tour.id}
                            className={`p-5 rounded-3xl border bg-white dark:bg-slate-900 flex flex-col gap-4 shadow-xs transition-all ${
                              isActive 
                                ? "border-amber-500 ring-2 ring-amber-500/15" 
                                : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                                  <Calendar className="w-3 h-3" /> {dateStr}
                                </span>
                                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-101 line-clamp-1 mt-0.5">
                                  {tour.matchName}
                                </h3>
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-wider bg-amber-550 text-white px-2 py-0.5 rounded-md bg-amber-500">
                                Trọng Tài
                              </span>
                            </div>

                            {/* Details with Creator */}
                            <div className="bg-slate-50 dark:bg-slate-950/40 rounded-2xl p-3 border border-slate-100 dark:border-slate-800/20 text-xs flex flex-col gap-2">
                              <div className="flex justify-between items-center text-slate-500">
                                <span>Chế độ: <strong className="text-slate-700 dark:text-slate-300">{getTournamentModeLabel(tour)}</strong></span>
                                <span>Số cự ly: <strong className="text-slate-700 dark:text-slate-300">{activeDistancesList.length}</strong></span>
                              </div>
                              <div className="flex justify-wrap gap-1 items-center text-[10px] text-slate-400 border-t border-slate-200/40 dark:border-slate-800/40 pt-2 leading-relaxed">
                                <User className="w-3 h-3 text-indigo-505" />
                                <span>Trưởng giải tạo: <strong className="text-indigo-650 dark:text-indigo-400">{tour.creatorEmail}</strong></span>
                              </div>
                            </div>

                            <div className="flex justify-end mt-1 border-t border-slate-100 dark:border-slate-800/40 pt-3">
                              <button
                                onClick={() => onSelectTournament(tour.id, tour)}
                                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                              >
                                <Award className="w-4 h-4" /> Vào ghi điểm / giám sát
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

        </div>
      )}

      {showConfirmDeleteId && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-fadeIn text-slate-800 dark:text-slate-100">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full shadow-2xl flex flex-col items-center text-center gap-4">
            <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-full">
              <Trash2 className="w-8 h-8 animate-pulse" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
              Xóa giải đấu khỏi Cloud?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
              Bạn có chắc chắn muốn xóa vĩnh viễn giải đấu{" "}
              <strong className="text-rose-600 dark:text-rose-400">
                "{tournaments.find((t) => t.id === showConfirmDeleteId)?.matchName || "Trống"}"
              </strong>{" "}
              khỏi Cloud? Toàn bộ danh sách VĐV, trọng tài và bảng điểm trực tuyến sẽ biến mất vĩnh viễn.
            </p>
            <div className="flex gap-2 w-full mt-2">
              <button
                type="button"
                onClick={() => setShowConfirmDeleteId(null)}
                className="flex-1 py-2 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleDelete(showConfirmDeleteId)}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                Đồng ý Xóa
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
