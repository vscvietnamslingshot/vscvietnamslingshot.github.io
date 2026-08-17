import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../context/LanguageContext";
import { SystemClub, MatchHistoryItem, Athlete } from "../types";
import { 
  subscribeToVscSystemClubs, 
  subscribeToVscSystemAthletes,
  createSystemClub,
  requestToJoinClub,
  cancelJoinRequest,
  handleClubJoinRequest,
  leaveClub,
  kickClubMember,
  addClubMemberDirectly,
  transferClubLeadership,
  updateClubProfile,
  deleteVscSystemClub,
  getFriendlyErrorMessage
} from "../lib/firebaseService";

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
import { VIETNAM_PROVINCES } from "../utils/provinces";
import { AthleteProfileModal } from "./AthleteProfileModal";
import { getHitCount } from "../utils/qualification";
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
  Info,
  Trophy,
  SlidersHorizontal,
  CheckCircle,
  Clock,
  LogOut,
  Sliders,
  Inbox,
  Save,
  PlusCircle,
  Shield,
  ArrowUpDown,
  AlertCircle,
  AlertTriangle
} from "lucide-react";

interface VscSystemClubsDirectoryProps {
  currentUser: any;
  userRole: string;
  history: MatchHistoryItem[];
  onlineTournaments?: any[];
  onOpenAuthModal: () => void;
}

// Stats helper to compute club performance
const getDetailedClubStats = (club: SystemClub, tournamentsList: any[]) => {
  let totalShots = 0;
  let totalHits = 0;
  let podiums = 0;

  const memberEmails = new Set(club.members?.map(m => m.email?.toLowerCase().trim()).filter(Boolean) || []);
  const memberAthleteIds = new Set(club.members?.map(m => m.athleteId?.toLowerCase().trim()).filter(Boolean) || []);

  // Track member contributions
  const memberContributions: Record<string, { shots: number; hits: number; accuracy: number }> = {};
  club.members?.forEach(m => {
    memberContributions[m.userId] = { shots: 0, hits: 0, accuracy: 0 };
  });

  tournamentsList.forEach(tour => {
    // To avoid double counting the same athlete (e.g. if present in both tour.athletes and tour.masterAthletes)
    const uniqueAthletesMap = new Map<string, any>();
    
    // We process masterAthletes first, then overwrite/prefer inputAthletes and athletes which are the active ones with scores
    const candidateAthletes = [
      ...(tour.masterAthletes || []),
      ...(tour.inputAthletes || []),
      ...(tour.athletes || [])
    ];
    
    candidateAthletes.forEach(ath => {
      if (!ath) return;
      const idKey = ath.id ? ath.id.trim().toLowerCase() : "";
      const emailKey = ath.email ? ath.email.trim().toLowerCase() : "";
      const key = idKey || emailKey || (ath.name ? ath.name.trim().toLowerCase() : "");
      if (!key) return;
      
      const existing = uniqueAthletesMap.get(key);
      if (!existing) {
        uniqueAthletesMap.set(key, ath);
      } else {
        const existingScoreCount = existing.scores ? Object.keys(existing.scores).length : 0;
        const currentScoreCount = ath.scores ? Object.keys(ath.scores).length : 0;
        if (currentScoreCount >= existingScoreCount) {
          uniqueAthletesMap.set(key, ath);
        }
      }
    });
    
    const allAthletes = Array.from(uniqueAthletesMap.values());

    const tournamentMembers = allAthletes.filter(ath => {
      const emailMatch = ath.email && memberEmails.has(ath.email.toLowerCase().trim());
      const idMatch = ath.id && memberAthleteIds.has(ath.id.toLowerCase().trim());
      return emailMatch || idMatch;
    });

    tournamentMembers.forEach(ath => {
      const distances = tour.distances || [];
      distances.forEach((dist: any) => {
        const hits = ath.scores?.[dist.id] || [];
        const wasShot = Array.isArray(hits) && hits.length > 0 && hits.some(v => v !== null && v !== undefined);
        
        if (wasShot) {
          const hitCount = getHitCount(hits);
          const shotsCount = tour.shotsCount || 10;
          const isPointMode = shotsCount === 1 && tour.directMaxPoints !== undefined && tour.directMaxPoints > 0;
          
          let distShots = shotsCount;
          let distHits = hitCount;
          
          if (isPointMode) {
            const mult = dist.multiplier || 1;
            distShots = (tour.directMaxPoints || 1) * mult;
            distHits = hitCount * mult;
          }
          
          totalShots += distShots;
          totalHits += distHits;

          // Find the actual club member reference to add contributions
          const matchedMember = club.members?.find(m => 
            (ath.email && m.email?.toLowerCase().trim() === ath.email.toLowerCase().trim()) || 
            (ath.id && m.athleteId?.toLowerCase().trim() === ath.id.toLowerCase().trim())
          );

          if (matchedMember) {
            const current = memberContributions[matchedMember.userId] || { shots: 0, hits: 0, accuracy: 0 };
            current.shots += distShots;
            current.hits += distHits;
            memberContributions[matchedMember.userId] = current;
          }
        }
      });
    });

    // Count Individual Podiums
    if (tour.distances && tour.distances.length > 0) {
      const activeAthletes = allAthletes.filter(a => a.status !== "Bỏ thi");
      const standings = activeAthletes.map(athlete => {
        let totalScore = 0;
        tour.distances.forEach((dist: any) => {
          const hits = athlete.scores?.[dist.id] || [];
          const hitCount = getHitCount(hits);
          totalScore += hitCount * dist.multiplier;
        });
        return { ...athlete, totalScore };
      }).sort((a, b) => b.totalScore - a.totalScore);

      standings.slice(0, Math.min(3, standings.length)).forEach(ath => {
        const isMember = (ath.email && memberEmails.has(ath.email.toLowerCase().trim())) ||
                         (ath.id && memberAthleteIds.has(ath.id.toLowerCase().trim()));
        if (isMember) {
          podiums++;
        }
      });
    }

    // Count Team Podiums
    const teamsList = tour.teamAthletes || [];
    if (teamsList.length > 0) {
      const teamStandings = [...teamsList].sort((a, b) => {
        const scoreA = typeof a.score === "number" ? a.score : 0;
        const scoreB = typeof b.score === "number" ? b.score : 0;
        return scoreB - scoreA;
      });

      teamStandings.slice(0, Math.min(3, teamStandings.length)).forEach(team => {
        if (team.name && team.name.toLowerCase().trim() === club.name.toLowerCase().trim()) {
          podiums++;
        }
      });
    }
  });

  // Calculate accuracies for contributions
  Object.keys(memberContributions).forEach(userId => {
    const item = memberContributions[userId];
    item.accuracy = item.shots > 0 ? (item.hits / item.shots) * 100 : 0;
  });

  const hitRate = totalShots > 0 ? (totalHits / totalShots) * 100 : 0;

  return {
    totalShots,
    totalHits,
    hitRate,
    podiums,
    memberContributions
  };
};

export const VscSystemClubsDirectory: React.FC<VscSystemClubsDirectoryProps> = ({
  currentUser,
  userRole,
  history,
  onlineTournaments = [],
  onOpenAuthModal
}) => {
  const { language } = useLanguage();
  const [clubs, setClubs] = useState<SystemClub[]>([]);
  const [systemAthletes, setSystemAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProvince, setSelectedProvince] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "members" | "shots" | "hits" | "hitRate">("name");

  // Selected Club Details Modal state
  const [selectedClub, setSelectedClub] = useState<SystemClub | null>(null);

  // Selected Athlete Profile Modal state for looking up club members
  const [selectedAthleteProfile, setSelectedAthleteProfile] = useState<Athlete | null>(null);

  // Athlete profile statistics memo (matching system directory design)
  const athleteStats = useMemo(() => {
    if (!selectedAthleteProfile) return null;
    const athleteIdLower = selectedAthleteProfile.id.trim().toLowerCase();
    const athleteEmailLower = selectedAthleteProfile.email?.trim().toLowerCase() || "";

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
        let matchShots = 0;
        let matchHits = 0;

        if (targetAthleteData.scores) {
          Object.values(targetAthleteData.scores).forEach((scoreArr) => {
            if (Array.isArray(scoreArr)) {
              matchShots += scoreArr.length;
              matchHits += scoreArr.filter((h) => h === true).length;
            }
          });
        }

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
  }, [selectedAthleteProfile, onlineTournaments, language]);

  // Subtab within Club details drawer: "overview" | "roster" | "admin"
  const [drawerTab, setDrawerTab] = useState<"overview" | "roster" | "admin">("overview");

  // Roster sorting state
  const [rosterSortBy, setRosterSortBy] = useState<"role" | "shots" | "hits" | "accuracy">("accuracy");

  // Form states for NEW Club creation
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newClubName, setNewClubName] = useState("");
  const [newClubProvince, setNewClubProvince] = useState("");
  const [customNewClubProvince, setCustomNewClubProvince] = useState("");
  const [newClubLogoUrl, setNewClubLogoUrl] = useState("");
  const [newClubBannerUrl, setNewClubBannerUrl] = useState("");
  const [isCompressingLogo, setIsCompressingLogo] = useState(false);
  const [isCompressingBanner, setIsCompressingBanner] = useState(false);
  const [newClubDesc, setNewClubDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState("");

  // Form states for EDITING club info (inside Admin panel)
  const [editName, setEditName] = useState("");
  const [editProvince, setEditProvince] = useState("");
  const [customEditProvince, setCustomEditProvince] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [editBannerUrl, setEditBannerUrl] = useState("");
  const [isEditCompressingLogo, setIsEditCompressingLogo] = useState(false);
  const [isEditCompressingBanner, setIsEditCompressingBanner] = useState(false);
  const [editDesc, setEditDesc] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Administrative actions state
  const [directAthleteId, setDirectAthleteId] = useState("");
  const [isAddingDirect, setIsAddingDirect] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showLeaveClubModalStep, setShowLeaveClubModalStep] = useState<number>(0);
  const [showDisbandClubModalStep, setShowDisbandClubModalStep] = useState<number>(0);
  const [transferTargetUserId, setTransferTargetUserId] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  // Active status of current logged-in user in relation to clubs
  const myClub = useMemo(() => {
    if (!currentUser) return null;
    return clubs.find(c => c.members?.some(m => m.userId === currentUser.uid)) || null;
  }, [clubs, currentUser]);

  const myPendingRequestClub = useMemo(() => {
    if (!currentUser) return null;
    return clubs.find(c => c.pendingRequests?.some(r => r.userId === currentUser.uid)) || null;
  }, [clubs, currentUser]);

  // Subscribe to real-time clubs & athletes
  useEffect(() => {
    setLoading(true);
    const unsubClubs = subscribeToVscSystemClubs((remoteClubs) => {
      setClubs(remoteClubs);
      setLoading(false);
    });

    const unsubAthletes = subscribeToVscSystemAthletes((remoteAthletes) => {
      setSystemAthletes(remoteAthletes);
    });

    return () => {
      unsubClubs();
      unsubAthletes();
    };
  }, []);

  // Update Edit form fields when selected club changes or enters admin tab
  useEffect(() => {
    if (selectedClub) {
      setEditName(selectedClub.name || "");
      const prov = selectedClub.province || "";
      const isCustom = prov && prov !== "" && !VIETNAM_PROVINCES.includes(prov);
      if (isCustom) {
        setEditProvince("Khác");
        setCustomEditProvince(prov);
      } else {
        setEditProvince(prov);
        setCustomEditProvince("");
      }
      setEditLogoUrl(selectedClub.logoUrl || "");
      setEditBannerUrl(selectedClub.bannerUrl || "");
      setEditDesc(selectedClub.description || "");
    }
  }, [selectedClub]);

  // If selectedClub is updated in remote, sync selectedClub object reference
  useEffect(() => {
    if (selectedClub) {
      const updated = clubs.find(c => c.id === selectedClub.id);
      if (updated) {
        setSelectedClub(updated);
      }
    }
  }, [clubs, selectedClub]);

  // Calculate detailed stats for each club
  const clubStatsMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof getDetailedClubStats>> = {};
    clubs.forEach(c => {
      map[c.id] = getDetailedClubStats(c, onlineTournaments);
    });
    return map;
  }, [clubs, onlineTournaments]);

  // Handle clicking a member to view their complete Athlete Profile
  const handleMemberClick = (m: any) => {
    const profile = systemAthletes.find(a => 
      (m.athleteId && a.id?.toLowerCase().trim() === m.athleteId?.toLowerCase().trim()) ||
      (m.email && a.email?.toLowerCase().trim() === m.email?.toLowerCase().trim())
    );
    if (profile) {
      setSelectedAthleteProfile(profile);
    } else {
      // Create a temporary Athlete profile so the biography modal can still show it beautifully!
      setSelectedAthleteProfile({
        id: m.athleteId || "N/A",
        name: m.name,
        email: m.email || "",
        gender: "Nam",
        dob: "---",
        province: "---",
        hometown: "---",
        avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
        team: selectedClub ? selectedClub.name : "VSC Club",
        idCard: "",
        scores: {}
      });
    }
  };

  // Handle Create Club Form Submit
  const handleCreateClubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsCreating(true);
    setFormError("");

    // Each user can only create 1 club or join 1 club
    if (myClub && userRole !== "admin") {
      setFormError(
        language === "en"
          ? "You are already a member or leader of a club. You must leave that club first."
          : "Bạn đang là thành viên hoặc ban quản trị của một câu lạc bộ khác. Hãy rời câu lạc bộ đó trước."
      );
      setIsCreating(false);
      return;
    }
    if (myPendingRequestClub && userRole !== "admin") {
      setFormError(
        language === "en"
          ? "You have a pending request to join another club. Please cancel it first."
          : "Bạn đang có yêu cầu xin gia nhập câu lạc bộ khác chưa được duyệt. Vui lòng hủy yêu cầu đó trước."
      );
      setIsCreating(false);
      return;
    }

    try {
      // Find current user's profile inside systemAthletes
      const userAthleteProfile = systemAthletes.find(
        ath => ath.email?.toLowerCase().trim() === currentUser.email?.toLowerCase().trim()
      );

      const isAdmin = userRole === "admin";
      const leaderAthleteId = isAdmin ? "" : (userAthleteProfile?.id || "");
      const leaderName = isAdmin ? "" : (userAthleteProfile?.name || currentUser.displayName || "Xạ Thủ VSC");

      await createSystemClub(
        newClubName.trim(),
        newClubLogoUrl.trim(),
        newClubProvince === "Khác" ? customNewClubProvince.trim() : newClubProvince,
        isAdmin ? "" : currentUser.uid,
        leaderName,
        isAdmin ? "" : (currentUser.email || ""),
        newClubDesc.trim(),
        newClubBannerUrl.trim()
      );

      setIsCreateModalOpen(false);
      setNewClubName("");
      setNewClubProvince("");
      setNewClubLogoUrl("");
      setNewClubBannerUrl("");
      setNewClubDesc("");
    } catch (err: any) {
      console.error(err);
      setFormError(getFriendlyErrorMessage(err) || err.message);
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Edit Club submit
  const handleUpdateClubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClub) return;
    setIsUpdating(true);
    try {
      await updateClubProfile(selectedClub.id, {
        name: editName.trim(),
        province: editProvince === "Khác" ? customEditProvince.trim() : editProvince,
        logoUrl: editLogoUrl.trim(),
        bannerUrl: editBannerUrl.trim(),
        description: editDesc.trim()
      });
      // Details update will automatically sync via useEffect
    } catch (err: any) {
      alert(getFriendlyErrorMessage(err) || err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle Delete Club
  const handleDeleteClub = () => {
    handleDisbandClubClick();
  };

  // Join a Club Request
  const handleJoinRequest = async (clubId: string) => {
    if (!currentUser) {
      onOpenAuthModal();
      return;
    }
    try {
      const userAthleteProfile = systemAthletes.find(
        ath => ath.email?.toLowerCase().trim() === currentUser.email?.toLowerCase().trim()
      );

      await requestToJoinClub(
        clubId,
        currentUser.uid,
        userAthleteProfile?.id || "",
        userAthleteProfile?.name || currentUser.displayName || "Xạ Thủ",
        currentUser.email || ""
      );
    } catch (err: any) {
      alert(getFriendlyErrorMessage(err) || err.message);
    }
  };

  // Withdraw Join Request
  const handleWithdrawJoinRequest = async (clubId: string) => {
    if (!currentUser) return;
    try {
      await cancelJoinRequest(clubId, currentUser.uid);
    } catch (err: any) {
      alert(getFriendlyErrorMessage(err) || err.message);
    }
  };

  // Accept/Reject Join Request
  const handleRequestAction = async (clubId: string, userId: string, action: "approve" | "reject") => {
    try {
      await handleClubJoinRequest(clubId, userId, action);
    } catch (err: any) {
      alert(getFriendlyErrorMessage(err) || err.message);
    }
  };

  // Direct recruiting of athlete by system Athlete ID
  const handleAddDirectMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClub || !directAthleteId.trim()) return;
    setIsAddingDirect(true);
    try {
      const cleanId = directAthleteId.trim().toUpperCase();
      await addClubMemberDirectly(selectedClub.id, cleanId, systemAthletes);
      setDirectAthleteId("");
    } catch (err: any) {
      alert(getFriendlyErrorMessage(err) || err.message);
    } finally {
      setIsAddingDirect(false);
    }
  };

  // Kick/remove member
  const handleKickMember = async (userId: string, memberName: string) => {
    if (!selectedClub) return;
    const confirmKick = window.confirm(
      language === "en" 
        ? `Are you sure you want to remove ${memberName} from this club?`
        : `Xác nhận loại bỏ vận động viên ${memberName} khỏi câu lạc bộ?`
    );
    if (!confirmKick) return;

    try {
      await kickClubMember(selectedClub.id, userId);
    } catch (err: any) {
      alert(getFriendlyErrorMessage(err) || err.message);
    }
  };

  // Leave club voluntarily
  const handleLeaveClub = () => {
    if (!selectedClub || !currentUser) return;
    if (selectedClub.leaderId === currentUser.uid) {
      alert(language === "en"
        ? "As the Club Leader, you must transfer leadership to another member before leaving!"
        : "Là Trưởng CLB, bạn phải chuyển nhượng quyền trưởng câu lạc bộ cho thành viên khác trước khi rời đi!");
      return;
    }
    setShowLeaveClubModalStep(1);
  };

  const handleConfirmLeaveClubStep2 = async () => {
    if (!selectedClub || !currentUser) return;
    try {
      await leaveClub(selectedClub.id, currentUser.uid);
      setShowLeaveClubModalStep(0);
      setSelectedClub(null);
    } catch (err: any) {
      setShowLeaveClubModalStep(0);
      if (err.message === "LEADER_MUST_TRANSFER" || err.message?.includes("LEADER_MUST_TRANSFER")) {
        alert(language === "en"
          ? "As the Club Leader, you must transfer leadership to another member before leaving!"
          : "Là Trưởng CLB, bạn phải chuyển nhượng quyền trưởng câu lạc bộ cho thành viên khác trước khi rời đi!");
      } else {
        alert(getFriendlyErrorMessage(err) || err.message);
      }
    }
  };

  const handleDisbandClubClick = () => {
    setShowDisbandClubModalStep(1);
  };

  const handleConfirmDisbandClubStep2 = async () => {
    if (!selectedClub || !currentUser) return;
    try {
      await deleteVscSystemClub(selectedClub.id);
      setShowDisbandClubModalStep(0);
      setSelectedClub(null);
      alert(language === "en" ? "Club disbanded successfully!" : "Đã giải tán câu lạc bộ thành công!");
    } catch (err: any) {
      setShowDisbandClubModalStep(0);
      alert(getFriendlyErrorMessage(err) || err.message);
    }
  };

  // Transfer Leadership Submit
  const handleTransferLeadership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClub || !transferTargetUserId) return;
    setIsTransferring(true);
    try {
      await transferClubLeadership(selectedClub.id, transferTargetUserId);
      setShowTransferModal(false);
      setTransferTargetUserId("");
      setDrawerTab("overview");
    } catch (err: any) {
      alert(getFriendlyErrorMessage(err) || err.message);
    } finally {
      setIsTransferring(false);
    }
  };

  // Process and Filter Clubs
  const filteredClubs = useMemo(() => {
    return clubs.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.province.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (c.leaderName && c.leaderName.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchProvince = selectedProvince === "all" || c.province === selectedProvince;
      return matchSearch && matchProvince;
    }).sort((a, b) => {
      const statsA = clubStatsMap[a.id] || { totalShots: 0, totalHits: 0, hitRate: 0 };
      const statsB = clubStatsMap[b.id] || { totalShots: 0, totalHits: 0, hitRate: 0 };

      if (sortBy === "members") {
        return (b.members?.length || 0) - (a.members?.length || 0);
      }
      if (sortBy === "shots") {
        return statsB.totalShots - statsA.totalShots;
      }
      if (sortBy === "hits") {
        return statsB.totalHits - statsA.totalHits;
      }
      if (sortBy === "hitRate") {
        return statsB.hitRate - statsA.hitRate;
      }
      // Sort by name as default
      return a.name.localeCompare(b.name, "vi");
    });
  }, [clubs, searchTerm, selectedProvince, sortBy, clubStatsMap]);

  // Ranked Club Members
  const rankedMembers = useMemo(() => {
    if (!selectedClub) return [];
    const stats = clubStatsMap[selectedClub.id];
    const contributions = stats?.memberContributions || {};

    return [...(selectedClub.members || [])].map(m => {
      const contrib = contributions[m.userId] || { shots: 0, hits: 0, accuracy: 0 };
      return {
        ...m,
        shots: contrib.shots,
        hits: contrib.hits,
        accuracy: contrib.accuracy
      };
    }).sort((a, b) => {
      if (rosterSortBy === "shots") {
        return b.shots - a.shots;
      }
      if (rosterSortBy === "hits") {
        return b.hits - a.hits;
      }
      if (rosterSortBy === "accuracy") {
        return b.accuracy - a.accuracy;
      }
      // Default sort by role (Leader first)
      if (a.role === "leader" && b.role !== "leader") return -1;
      if (b.role === "leader" && a.role !== "leader") return 1;
      return a.name.localeCompare(b.name, "vi");
    });
  }, [selectedClub, rosterSortBy, clubStatsMap]);

  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 text-slate-800 dark:text-slate-100 transition-colors">
      
      {/* HEADER PORTAL */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-gradient-to-br from-[#9c0c13] to-[#80090e] text-white rounded-2xl p-6 shadow-lg border border-red-800 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10 shrink-0 select-none pointer-events-none transform translate-x-12 -translate-y-8">
            <Building className="w-96 h-96" />
          </div>
          <div className="space-y-2 relative z-10 text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-[10px] uppercase font-black tracking-wider text-yellow-300 border border-white/15">
              <Sparkles className="w-3.5 h-3.5" />
              VSC Vietnam Clubs Database
            </div>
            <h2 className="text-xl md:text-2xl font-black italic tracking-tight uppercase">
              {language === "en" ? "National Slingshot Clubs Directory" : "Danh Sách CLB Hệ Thống Quốc Gia"}
            </h2>
            <p className="text-xs md:text-sm text-red-100 max-w-2xl leading-relaxed">
              {language === "en"
                ? "Official registry database, structural rosters, combined target precision rates, and ranking charts for accredited Slingshot clubs nationwide."
                : "Hệ thống đăng ký, lưu trữ cơ cấu thành viên, tổng hợp chỉ số bắn chuẩn xác và bảng phong độ thi đấu của các Câu lạc bộ Ná cao su thể thao trên toàn quốc."}
            </p>
          </div>

          {/* Action controls */}
          <div className="shrink-0 flex flex-wrap gap-3 relative z-10 md:self-center">
            {/* Admin-only Button */}
            {userRole === "admin" && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-yellow-400 hover:bg-yellow-450 text-slate-900 font-extrabold text-xs px-5 py-3 rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer border border-yellow-500 uppercase tracking-wider animate-pulse-slow"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                {language === "en" ? "Create New System Club" : "Tạo CLB Hệ Thống Mới"}
              </button>
            )}

            {/* Normal register button */}
            {!myClub && !myPendingRequestClub && (
              <button
                onClick={() => {
                  if (currentUser) {
                    setIsCreateModalOpen(true);
                  } else {
                    onOpenAuthModal();
                  }
                }}
                className="bg-yellow-400 hover:bg-yellow-450 text-slate-900 font-extrabold text-xs px-5 py-3 rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer border border-yellow-500 uppercase tracking-wider"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                {language === "en" ? "Register Club" : "Thành Lập CLB Mới"}
              </button>
            )}

            {/* My Club Space */}
            {myClub && (
              <button
                onClick={() => {
                  setSelectedClub(myClub);
                  setDrawerTab("overview");
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-5 py-3 rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer border border-emerald-700 uppercase tracking-wider"
              >
                <Building className="w-4 h-4 text-white" />
                {language === "en" ? "My Club Space" : "Không Gian CLB Của Tôi"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SYSTEM DIRECTORY FILTER BAR */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 flex flex-col gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 p-4 rounded-2xl shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
          
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={language === "en" ? "Search club name or leader..." : "Tìm tên CLB, tỉnh thành, hoặc trưởng nhóm..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 font-bold"
            />
          </div>

          {/* Filtering Drops */}
          <div className="flex flex-wrap gap-2.5 w-full md:w-auto justify-end">
            {/* Province Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 hidden lg:inline">Tỉnh thành:</span>
              <select
                value={selectedProvince}
                onChange={(e) => setSelectedProvince(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                <option value="all">-- {language === "en" ? "All Provinces" : "Tất Cả Tỉnh Thành"} --</option>
                {VIETNAM_PROVINCES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Sort Drop */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 hidden lg:inline">Sắp xếp:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                <option value="name">{language === "en" ? "Name (A-Z)" : "Tên (A-Z)"}</option>
                <option value="members">{language === "en" ? "Member Count" : "Số Lượng Thành Viên"}</option>
                <option value="shots">{language === "en" ? "Total Shots Played" : "Tổng Số Loạt Bắn"}</option>
                <option value="hits">{language === "en" ? "Total Hits Landed" : "Tổng Số Điểm Chạm"}</option>
                <option value="hitRate">{language === "en" ? "Average Hit Rate %" : "Tỷ Lệ Bắn Trúng %"}</option>
              </select>
            </div>
          </div>
        </div>

        {/* LOADING & EMPTY STATES */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-xs text-slate-400 font-bold">{language === "en" ? "Syncing club rosters with Firestore cloud database..." : "Đang tải dữ liệu và đồng bộ danh sách CLB..."}</p>
          </div>
        ) : filteredClubs.length === 0 ? (
          <div className="p-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-center bg-white dark:bg-slate-900 shadow-2xs flex flex-col items-center justify-center gap-3">
            <Inbox className="w-10 h-10 text-slate-400" />
            <div>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">{language === "en" ? "No Clubs Found" : "Không tìm thấy câu lạc bộ nào"}</h4>
              <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
                {language === "en" ? "Try adjusting your search criteria or register a new accredited club!" : "Thay đổi từ khóa tìm kiếm hoặc bấm nút Thành Lập CLB mới để mở hồ sơ CLB của riêng bạn!"}
              </p>
            </div>
          </div>
        ) : (
          /* CLUBS GRID LIST */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClubs.map(club => {
              const stats = clubStatsMap[club.id] || { totalShots: 0, totalHits: 0, hitRate: 0, podiums: 0 };
              const isCurrentUserMember = club.members?.some(m => m.userId === currentUser?.uid);
              const isCurrentUserLeader = club.leaderId === currentUser?.uid || userRole === "admin";

              return (
                <div
                  key={club.id}
                  onClick={() => {
                    setSelectedClub(club);
                    setDrawerTab("overview");
                  }}
                  className="group relative bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-5 shadow-2xs hover:shadow-md hover:border-indigo-500/30 dark:hover:border-indigo-500/30 transition-all cursor-pointer flex flex-col justify-between gap-5 text-left"
                >
                  <div className="flex items-start gap-4">
                    <img
                      src={club.logoUrl || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=150"}
                      alt={club.name}
                      className="w-14 h-14 rounded-xl object-cover border border-slate-100 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=150";
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-extrabold text-slate-800 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {club.name}
                        </h3>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-bold flex items-center gap-1 uppercase tracking-wider">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {club.province}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed italic">
                        {club.description ? `"${club.description}"` : `Hội nhóm quy tụ xạ thủ Ná cao su thể thao ${club.province}.`}
                      </p>
                    </div>
                  </div>

                  {/* MINI STATS TILES */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-950/65 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850 text-center">
                    <div>
                      <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">VĐV</span>
                      <span className="text-xs font-black text-slate-700 dark:text-slate-200">{club.members?.length || 0}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Trúng %</span>
                      <span className="text-xs font-black text-slate-700 dark:text-slate-200">{stats.hitRate.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Bục</span>
                      <span className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center justify-center gap-0.5 text-yellow-600 dark:text-yellow-400">
                        <Trophy className="w-3 h-3 fill-current" />
                        {stats.podiums}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-850 pt-3.5 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="truncate">
                      Leader: <strong className="text-slate-600 dark:text-slate-300 font-extrabold">{club.leaderId ? club.leaderName : (language === "en" ? "None" : "Chưa có")}</strong>
                    </span>

                    {/* Member Status Pill */}
                    {isCurrentUserLeader ? (
                      <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-600 dark:text-amber-400 font-extrabold rounded-md text-[9px] uppercase">
                        Trưởng CLB
                      </span>
                    ) : isCurrentUserMember ? (
                      <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 font-extrabold rounded-md text-[9px] uppercase">
                        Thành Viên
                      </span>
                    ) : myPendingRequestClub?.id === club.id ? (
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-850 text-slate-500 font-extrabold rounded-md text-[9px] uppercase animate-pulse">
                        Chờ duyệt
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE NEW CLUB MODAL */}
      {isCreateModalOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm transition-opacity animate-fadeIn text-slate-800 dark:text-slate-100">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 animate-scaleIn">
            
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building className="w-5 h-5 text-indigo-500" />
                {language === "en" ? "Register Slingshot Club" : "Thành Lập Câu Lạc Bộ Mới"}
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 rounded-xl mb-4 text-xs text-red-600 dark:text-red-400 flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateClubSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                  {language === "en" ? "Club Name *" : "Tên Câu Lạc Bộ *"}
                </label>
                <input
                  type="text"
                  required
                  placeholder="vd: Sài Gòn Slingshot Team"
                  value={newClubName}
                  onChange={(e) => setNewClubName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                  {language === "en" ? "Primary Province *" : "Tỉnh Thành Hoạt Động *"}
                </label>
                <select
                  required
                  value={newClubProvince}
                  onChange={(e) => setNewClubProvince(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 font-bold"
                >
                  <option value="">-- {language === "en" ? "Select Province" : "Chọn Tỉnh Thành"} --</option>
                  {VIETNAM_PROVINCES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                  <option value="Khác">{language === "en" ? "Other (Self-input)" : "Khác (Tự nhập)"}</option>
                </select>

                {newClubProvince === "Khác" && (
                  <div className="mt-2.5 animate-fadeIn">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      {language === "en" ? "Enter Custom Province/City *" : "Nhập Tỉnh Thành Khác *"}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={language === "en" ? "e.g., California, Tokyo,..." : "vd: Nước Ngoài, USA, Hòa Bình,..."}
                      value={customNewClubProvince}
                      onChange={(e) => setCustomNewClubProvince(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 font-bold"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5 flex justify-between items-center">
                  <span>{language === "en" ? "Club Logo *" : "Logo Câu Lạc Bộ *"}</span>
                  {isCompressingLogo && (
                    <span className="text-[10px] text-indigo-500 flex items-center gap-1 animate-pulse font-normal lowercase">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      {language === "en" ? "compressing..." : "đang nén..."}
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                    {newClubLogoUrl ? (
                      <img src={newClubLogoUrl} alt="Logo Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Building className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      id="create-logo-file-input"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsCompressingLogo(true);
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                          try {
                            const compressed = await compressImage(event.target?.result as string, 180, 180);
                            setNewClubLogoUrl(compressed);
                          } catch (err) {
                            console.error(err);
                          } finally {
                            setIsCompressingLogo(false);
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    <label
                      htmlFor="create-logo-file-input"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg cursor-pointer border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {language === "en" ? "Upload Logo" : "Tải Logo Lên"}
                    </label>
                    <input
                      type="url"
                      placeholder={language === "en" ? "Or paste Logo URL (https://...)" : "Hoặc dán URL ảnh Logo (https://...)"}
                      value={newClubLogoUrl}
                      onChange={(e) => setNewClubLogoUrl(e.target.value)}
                      className="w-full mt-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-white focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5 flex justify-between items-center">
                  <span>{language === "en" ? "Club Banner" : "Ảnh Bìa / Banner CLB"}</span>
                  {isCompressingBanner && (
                    <span className="text-[10px] text-indigo-500 flex items-center gap-1 animate-pulse font-normal lowercase">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      {language === "en" ? "compressing..." : "đang nén..."}
                    </span>
                  )}
                </label>
                <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  {newClubBannerUrl && (
                    <div className="w-full h-20 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden relative">
                      <img src={newClubBannerUrl} alt="Banner Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setNewClubBannerUrl("")}
                        className="absolute top-1.5 right-1.5 p-1 bg-slate-900/60 hover:bg-slate-900 text-white rounded-full transition-colors cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      id="create-banner-file-input"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsCompressingBanner(true);
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                          try {
                            const compressed = await compressImage(event.target?.result as string, 800, 300);
                            setNewClubBannerUrl(compressed);
                          } catch (err) {
                            console.error(err);
                          } finally {
                            setIsCompressingBanner(false);
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    <label
                      htmlFor="create-banner-file-input"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg cursor-pointer border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {language === "en" ? "Upload Banner" : "Tải Ảnh Bìa Lên"}
                    </label>
                    <input
                      type="url"
                      placeholder={language === "en" ? "Or paste Banner URL (https://...)" : "Hoặc dán URL ảnh bìa (https://...)"}
                      value={newClubBannerUrl}
                      onChange={(e) => setNewClubBannerUrl(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-white focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                  {language === "en" ? "Motto / Description" : "Mô Tả / Tôn Chỉ Hoạt Động"}
                </label>
                <textarea
                  rows={3}
                  placeholder={language === "en" ? "Brief info about club operations..." : "Giới thiệu ngắn gọn về câu lạc bộ, phương châm tập luyện..."}
                  value={newClubDesc}
                  onChange={(e) => setNewClubDesc(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 resize-none"
                />
              </div>

              <div className="flex gap-3 mt-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs hover:bg-slate-200 dark:hover:bg-slate-750 transition-colors cursor-pointer text-center"
                >
                  {language === "en" ? "Cancel" : "Hủy Bỏ"}
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer text-center flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
                >
                  {isCreating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {language === "en" ? "Create Club" : "Đăng Ký Thành Lập"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* SELECTED CLUB DETAILS DRAWER / SIDEBAR (PROFESSIONAL CONTROL DASHBOARD) */}
      {selectedClub && typeof document !== "undefined" && createPortal(
        (() => {
          const club = selectedClub;
          const stats = clubStatsMap[club.id] || { totalShots: 0, totalHits: 0, hitRate: 0, podiums: 0 };
          const isLeader = club.leaderId === currentUser?.uid || userRole === "admin";
          const isMember = club.members?.some(m => m.userId === currentUser?.uid);
          const hasPending = club.pendingRequests?.some(r => r.userId === currentUser?.uid);

          return (
            <div className="fixed inset-0 z-[10005] flex justify-end bg-slate-950/65 backdrop-blur-xs transition-opacity animate-fadeIn text-slate-800 dark:text-slate-100">
              <div 
                className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col justify-between animate-slideInRight border-l border-slate-200 dark:border-slate-800"
                onClick={(e) => e.stopPropagation()}
              >
                
                {/* Header Title bar at the very top */}
                <div className="px-6 py-4 flex justify-between items-center bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    VSC OFFICIAL CLUB HUB
                  </h3>
                  <button
                    onClick={() => setSelectedClub(null)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer text-slate-500 dark:text-slate-400"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Banner & Brand Area */}
                <div className="relative bg-white dark:bg-slate-900 shrink-0">
                  {/* Banner Image Container */}
                  <div className="px-6 pt-3">
                    <div className="relative h-32 sm:h-44 w-full rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-750/50 shadow-sm">
                      <img
                        src={club.bannerUrl || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&q=80"}
                        alt={`${club.name} Banner Background`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&q=80";
                        }}
                      />
                      {/* Dark overlay just to make banner look cinematic */}
                      <div className="absolute inset-0 bg-slate-950/15"></div>
                    </div>
                  </div>

                  {/* Info details space on the right of the overlapping logo */}
                  <div className="relative px-6 pt-4 pb-3 flex gap-4 items-start">
                    {/* Placeholder spacer so that text doesn't overlap the logo which floats from below */}
                    <div className="w-20 sm:w-24 shrink-0"></div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          {club.name}
                        </h2>
                        <span className="px-2 py-0.5 rounded bg-yellow-400 text-slate-950 text-[9px] font-black uppercase tracking-wider">
                          {club.province}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold flex items-center gap-1">
                        Leader: <span className="text-slate-800 dark:text-slate-200 font-extrabold">{club.leaderId ? club.leaderName : (language === "en" ? "None" : "Chưa có")}</span>
                      </p>
                    </div>
                  </div>

                  {/* Dark navigation bar at the bottom with overlapping circular logo */}
                  <div className="relative bg-[#0b0c10] text-white h-16 flex items-center shadow-md">
                    {/* Overlapping circular logo */}
                    <div className="absolute left-6 -top-12 sm:-top-14 z-20">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-1 border-[#E6E6E6] bg-[#FFFFFF] overflow-hidden shadow-lg">
                        <img
                          src={club.logoUrl || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=150"}
                          alt={club.name}
                          className="w-full h-full object-cover rounded-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=150";
                          }}
                        />
                      </div>
                    </div>

                    {/* Navigation Items (HIỆU SUẤT, THÀNH VIÊN & RANK, BẢNG QUẢN TRỊ) */}
                    <div className="flex w-full h-full pl-[112px] sm:pl-[128px] pr-2 items-stretch bg-[#001751]">
                      {/* Tab 1: Hiệu suất */}
                      <button
                        onClick={() => setDrawerTab("overview")}
                        className="relative flex-1 flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer group"
                      >
                        <span className={`flex items-center justify-center gap-1 text-[10px] sm:text-xs font-black uppercase tracking-wider transition-colors ${
                          drawerTab === "overview" ? "text-yellow-400 font-black" : "text-slate-400 group-hover:text-white"
                        }`}>
                          <Activity className="w-3.5 h-3.5 shrink-0" />
                          <span>{language === "en" ? "Performance" : "HIỆU SUẤT"}</span>
                        </span>
                        {drawerTab === "overview" && (
                          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-yellow-400 rounded-t-full"></div>
                        )}
                      </button>

                      {/* Tab 2: Thành viên & Rank */}
                      <button
                        onClick={() => setDrawerTab("roster")}
                        className="relative flex-1 flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer group"
                      >
                        <span className={`flex items-center justify-center gap-1 text-[10px] sm:text-xs font-black uppercase tracking-wider transition-colors ${
                          drawerTab === "roster" ? "text-yellow-400 font-black" : "text-slate-400 group-hover:text-white"
                        }`}>
                          <Users className="w-3.5 h-3.5 shrink-0" />
                          <span>{language === "en" ? "Roster" : "THÀNH VIÊN & RANK"}</span>
                        </span>
                        {drawerTab === "roster" && (
                          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-yellow-400 rounded-t-full"></div>
                        )}
                      </button>

                      {/* Tab 3: Bảng quản trị */}
                      {isLeader && (
                        <button
                          onClick={() => setDrawerTab("admin")}
                          className="relative flex-1 flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer group"
                        >
                          <span className={`flex items-center justify-center gap-1 text-[10px] sm:text-xs font-black uppercase tracking-wider transition-colors ${
                            drawerTab === "admin" ? "text-yellow-400 font-black" : "text-slate-400 group-hover:text-white"
                          }`}>
                            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                            <span>{language === "en" ? "Control" : "BẢNG QUẢN TRỊ"}</span>
                          </span>
                          {drawerTab === "admin" && (
                            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-yellow-400 rounded-t-full"></div>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Drawer Body Panel */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950/40">

                  {/* OVERVIEW SUBTAB */}
                  {drawerTab === "overview" && (
                    <div className="flex flex-col gap-6">
                      
                      {/* Description Card */}
                      {club.description && (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 p-4 rounded-xl shadow-xs">
                          <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-2 flex items-center gap-1">
                            <Info className="w-3.5 h-3.5 text-slate-400" />
                            {language === "en" ? "Club Motto" : "Giới Thiệu Tôn Chỉ"}
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic">
                            "{club.description}"
                          </p>
                        </div>
                      )}

                      {/* Performance Indicators */}
                      <div>
                        <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-3">
                          {language === "en" ? "System-Wide Performance Metrics" : "Chỉ Số Hiệu Suất Hệ Thống (Mới Nhất)"}
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 p-4 rounded-xl shadow-xs flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              {language === "en" ? "Combined Shots" : "Tổng Loạt Bắn"}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              <Activity className="w-4 h-4 text-indigo-500" />
                              <span className="text-lg font-black text-slate-800 dark:text-white">
                                {stats.totalShots}
                              </span>
                            </div>
                          </div>

                          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 p-4 rounded-xl shadow-xs flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              {language === "en" ? "Combined Hits" : "Tổng Số Hit Đánh Trúng"}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              <CheckCircle className="w-4 h-4 text-emerald-500" />
                              <span className="text-lg font-black text-slate-800 dark:text-white">
                                {stats.totalHits}
                              </span>
                            </div>
                          </div>

                          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 p-4 rounded-xl shadow-xs flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              {language === "en" ? "Overall Precision Rate" : "Tỷ Lệ Bắn Trúng TB"}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              <Sliders className="w-4 h-4 text-amber-500" />
                              <span className="text-lg font-black text-slate-800 dark:text-white">
                                {stats.hitRate.toFixed(1)}%
                              </span>
                            </div>
                          </div>

                          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 p-4 rounded-xl shadow-xs flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              {language === "en" ? "Championship Podiums" : "Số Lần Đạt Bục (Top 3)"}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              <Trophy className="w-4 h-4 text-yellow-500" />
                              <span className="text-lg font-black text-slate-800 dark:text-white">
                                {stats.podiums}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Active Roster Preview */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-xl p-4 shadow-xs">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-wider">
                            {language === "en" ? "Roster Overview" : "Sơ Lược Đội Hình"}
                          </h4>
                          <span className="text-[10px] bg-slate-50 dark:bg-slate-950 px-2.5 py-0.5 rounded-full text-indigo-600 font-bold">
                            {club.members?.length || 0} {language === "en" ? "Competitors" : "Vận động viên"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {club.members?.map(m => {
                            const profile = systemAthletes.find(a => 
                              (m.athleteId && a.id?.toLowerCase().trim() === m.athleteId?.toLowerCase().trim()) ||
                              (m.email && a.email?.toLowerCase().trim() === m.email?.toLowerCase().trim())
                            );
                            const avatarUrl = profile?.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150";
                            const athleteId = profile?.id || m.athleteId || "TMP-ID";
                            
                            return (
                              <div
                                key={m.userId}
                                onClick={() => handleMemberClick(m)}
                                className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-150/40 dark:border-slate-850 rounded-xl cursor-pointer transition-all"
                              >
                                <img
                                  src={avatarUrl}
                                  alt={m.name}
                                  className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-800 shrink-0"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150";
                                  }}
                                  referrerPolicy="no-referrer"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate block">
                                      {m.name}
                                    </span>
                                    {m.role === "leader" && (
                                      <span className="text-[8px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 px-1 py-0.5 rounded font-extrabold shrink-0">
                                        LDR
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-indigo-500 font-extrabold block">
                                    {athleteId}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ROSTER SUBTAB WITH RANK SORTING */}
                  {drawerTab === "roster" && (
                    <div className="flex flex-col gap-4">
                      
                      {/* Sort Controls */}
                      <div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 p-3.5 rounded-xl shadow-xs">
                        <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider flex items-center gap-1">
                          <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500" />
                          {language === "en" ? "Rank Members By:" : "Sắp xếp Rank thành viên:"}
                        </span>
                        
                        <select
                          value={rosterSortBy}
                          onChange={(e) => setRosterSortBy(e.target.value as any)}
                          className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-300"
                        >
                          <option value="role">{language === "en" ? "Position / Alphabet" : "Chức Vụ & Bảng Chữ Cái"}</option>
                          <option value="shots">{language === "en" ? "Most Shots Played" : "VĐV Bắn Nhiều Nhất"}</option>
                          <option value="hits">{language === "en" ? "Most Hits Landed" : "Xạ Thủ Trúng Nhiều Nhất"}</option>
                          <option value="accuracy">{language === "en" ? "Highest Accuracy %" : "Độ Chính Xác Cao Nhất %"}</option>
                        </select>
                      </div>

                      {/* Roster Cards List */}
                      <div className="flex flex-col gap-2">
                        {rankedMembers.map((member, index) => {
                          const profile = systemAthletes.find(a => 
                            (member.athleteId && a.id?.toLowerCase().trim() === member.athleteId?.toLowerCase().trim()) ||
                            (member.email && a.email?.toLowerCase().trim() === member.email?.toLowerCase().trim())
                          );
                          const avatarUrl = profile?.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150";
                          const athleteId = profile?.id || member.athleteId || "TMP-ID";

                          return (
                            <div
                              key={member.userId}
                              onClick={() => handleMemberClick(member)}
                              className="bg-white dark:bg-slate-900 border border-slate-200/40 dark:border-slate-850 p-4 rounded-xl flex items-center justify-between gap-4 shadow-3xs hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all cursor-pointer"
                            >
                              <div className="flex items-center gap-3">
                                {/* Rank position numbers if sorted by statistics */}
                                {rosterSortBy !== "role" && (
                                  <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center font-black text-xs text-indigo-600 dark:text-indigo-400 shrink-0">
                                    #{index + 1}
                                  </div>
                                )}

                                <img
                                  src={avatarUrl}
                                  alt={member.name}
                                  className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-800 shrink-0"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150";
                                  }}
                                  referrerPolicy="no-referrer"
                                />
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-slate-800 dark:text-white">
                                      {member.name}
                                    </span>
                                    {member.role === "leader" && (
                                      <span className="inline-flex items-center gap-0.5 px-2 py-0.2 rounded-full text-[8px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-950">
                                        {language === "en" ? "Leader" : "Trưởng CLB"}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400 mt-0.5">
                                    <span>{member.email}</span>
                                    {athleteId && (
                                      <>
                                        <span className="text-slate-200 dark:text-slate-800">•</span>
                                        <span className="font-extrabold text-indigo-500">{athleteId}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Contribution Statistics Badge */}
                              <div className="text-right flex flex-col gap-0.5 shrink-0">
                                {member.shots > 0 ? (
                                  <>
                                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                                      {member.hits}/{member.shots} Hits
                                    </span>
                                    <span className="text-[10px] text-emerald-500 font-extrabold">
                                      {member.accuracy.toFixed(1)}% Acc
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">
                                    Chưa ra sân
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ADMINISTRATIVE SUBTAB (CONTROL PANEL FOR CLUB LEADER) */}
                  {drawerTab === "admin" && isLeader && (
                    <div className="flex flex-col gap-6">
                      
                      {/* Edit Profile Form */}
                      <form
                        onSubmit={handleUpdateClubSubmit}
                        className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-xl p-5 shadow-xs flex flex-col gap-4"
                      >
                        <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-wider border-b border-slate-100 dark:border-slate-850 pb-2 flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                          {language === "en" ? "Edit Club Branding" : "Cấu Hình Thương Hiệu CLB"}
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              {language === "en" ? "Club Name *" : "Tên Câu Lạc Bộ *"}
                            </label>
                            <input
                              type="text"
                              required
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-white font-bold"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              {language === "en" ? "Province *" : "Tỉnh Thành *"}
                            </label>
                            <select
                              required
                              value={editProvince}
                              onChange={(e) => setEditProvince(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-white font-bold"
                            >
                              <option value="">-- Chọn Tỉnh Thành --</option>
                              {VIETNAM_PROVINCES.map(p => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                              <option value="Khác">{language === "en" ? "Other (Self-input)" : "Khác (Tự nhập)"}</option>
                            </select>

                            {editProvince === "Khác" && (
                              <div className="mt-2 animate-fadeIn">
                                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                                  {language === "en" ? "Enter Custom Province *" : "Nhập Tỉnh Thành Khác *"}
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder={language === "en" ? "e.g., California, USA,..." : "vd: USA, Hàn Quốc,..."}
                                  value={customEditProvince}
                                  onChange={(e) => setCustomEditProvince(e.target.value)}
                                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-white font-bold focus:outline-hidden"
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex justify-between items-center">
                            <span>{language === "en" ? "Logo Image" : "Ảnh Đại Diện (Logo)"}</span>
                            {isEditCompressingLogo && (
                              <span className="text-[10px] text-indigo-500 flex items-center gap-1 animate-pulse font-normal lowercase">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                {language === "en" ? "compressing..." : "đang nén..."}
                              </span>
                            )}
                          </label>
                          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-850">
                            <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                              {editLogoUrl ? (
                                <img src={editLogoUrl} alt="Logo" className="w-full h-full object-cover" />
                              ) : (
                                <Building className="w-6 h-6 text-slate-400" />
                              )}
                            </div>
                            <div className="flex-1">
                              <input
                                type="file"
                                accept="image/*"
                                id="edit-logo-file-input"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setIsEditCompressingLogo(true);
                                  const reader = new FileReader();
                                  reader.onload = async (event) => {
                                    try {
                                      const compressed = await compressImage(event.target?.result as string, 180, 180);
                                      setEditLogoUrl(compressed);
                                    } catch (err) {
                                      console.error(err);
                                    } finally {
                                      setIsEditCompressingLogo(false);
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }}
                              />
                              <label
                                htmlFor="edit-logo-file-input"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg cursor-pointer border border-slate-200 dark:border-slate-700 transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                {language === "en" ? "Upload Logo" : "Tải Logo Mới"}
                              </label>
                              <input
                                type="url"
                                placeholder="Logo URL (HTTPS)"
                                value={editLogoUrl}
                                onChange={(e) => setEditLogoUrl(e.target.value)}
                                className="w-full mt-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-white focus:outline-hidden"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex justify-between items-center">
                            <span>{language === "en" ? "Banner Image" : "Ảnh Bìa / Banner CLB"}</span>
                            {isEditCompressingBanner && (
                              <span className="text-[10px] text-indigo-500 flex items-center gap-1 animate-pulse font-normal lowercase">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                {language === "en" ? "compressing..." : "đang nén..."}
                              </span>
                            )}
                          </label>
                          <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-850">
                            {editBannerUrl && (
                              <div className="w-full h-20 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden relative">
                                <img src={editBannerUrl} alt="Banner Preview" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => setEditBannerUrl("")}
                                  className="absolute top-1.5 right-1.5 p-1 bg-slate-900/60 hover:bg-slate-900 text-white rounded-full transition-colors cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              <input
                                type="file"
                                accept="image/*"
                                id="edit-banner-file-input"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setIsEditCompressingBanner(true);
                                  const reader = new FileReader();
                                  reader.onload = async (event) => {
                                    try {
                                      const compressed = await compressImage(event.target?.result as string, 800, 300);
                                      setEditBannerUrl(compressed);
                                    } catch (err) {
                                      console.error(err);
                                    } finally {
                                      setIsEditCompressingBanner(false);
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }}
                              />
                              <label
                                htmlFor="edit-banner-file-input"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg cursor-pointer border border-slate-200 dark:border-slate-700 transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                {language === "en" ? "Upload Banner" : "Tải Ảnh Bìa Mới"}
                              </label>
                              <input
                                type="url"
                                placeholder="Banner URL (HTTPS)"
                                value={editBannerUrl}
                                onChange={(e) => setEditBannerUrl(e.target.value)}
                                className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-white focus:outline-hidden"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            {language === "en" ? "Motto / Description" : "Khẩu Hiệu / Tôn Chỉ Hoạt Động"}
                          </label>
                          <textarea
                            rows={2}
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-white resize-none"
                          />
                        </div>

                        <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-850 pt-3">
                          <button
                            type="button"
                            onClick={handleDeleteClub}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {language === "en" ? "Delete Club" : "Giải Tán CLB"}
                          </button>

                          <button
                            type="submit"
                            disabled={isUpdating || isEditCompressingLogo || isEditCompressingBanner}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-xs transition-colors"
                          >
                            <Save className="w-3.5 h-3.5" />
                            {isUpdating ? (language === "en" ? "Saving..." : "Đang lưu...") : (language === "en" ? "Save Changes" : "Lưu Cập Nhật")}
                          </button>
                        </div>
                      </form>

                      {/* Recruting Direct Athlete Link Form */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-xl p-5 shadow-xs flex flex-col gap-3">
                        <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-wider flex items-center justify-between">
                          <span>{language === "en" ? "Recruit Direct Member" : "Thêm VĐV Trực Tiếp"}</span>
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {language === "en"
                            ? "Input an existing official VSC Athlete ID (VSC-xxxx) to register and link their performance directly to your roster."
                            : "Nhập mã số định danh VSC-xxxx của vận động viên đã tạo hồ sơ hệ thống để đưa thẳng họ vào cơ cấu CLB."}
                        </p>

                        <form onSubmit={handleAddDirectMemberSubmit} className="flex gap-2">
                          <input
                            type="text"
                            value={directAthleteId}
                            onChange={(e) => setDirectAthleteId(e.target.value)}
                            placeholder="vd: VSC-0001"
                            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-white font-bold uppercase"
                          />
                          <button
                            type="submit"
                            disabled={isAddingDirect || !directAthleteId.trim()}
                            className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black cursor-pointer transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                          >
                            {isAddingDirect ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <PlusCircle className="w-3.5 h-3.5" />
                            )}
                            {language === "en" ? "Add" : "Thêm Thẳng"}
                          </button>
                        </form>
                      </div>

                      {/* Applications Joining Queue */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-xl p-5 shadow-xs flex flex-col gap-3">
                        <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-wider flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2">
                          <span>{language === "en" ? "Pending Applications" : "Yêu Cầu Gia Nhập Đang Chờ"}</span>
                          {club.pendingRequests && club.pendingRequests.length > 0 && (
                            <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[9px] font-bold animate-pulse">
                              {club.pendingRequests.length}
                            </span>
                          )}
                        </h4>

                        {(!club.pendingRequests || club.pendingRequests.length === 0) ? (
                          <div className="py-6 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-1 bg-slate-50/20 dark:bg-slate-950/10 rounded-xl border border-dashed border-slate-100 dark:border-slate-800">
                            <Clock className="w-4 h-4 text-slate-300" />
                            <span>{language === "en" ? "No applications pending" : "Không có đơn xin gia nhập nào đang chờ"}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {club.pendingRequests.map(req => (
                              <div key={req.userId} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-xl flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    {req.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    {req.email} {req.athleteId && <span className="text-indigo-500 font-extrabold ml-1">({req.athleteId})</span>}
                                  </div>
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                  <button
                                    onClick={() => handleRequestAction(club.id, req.userId, "reject")}
                                    className="px-2.5 py-1 text-[10px] font-bold text-red-500 hover:bg-red-50 rounded-md cursor-pointer transition-all"
                                  >
                                    Từ chối
                                  </button>
                                  <button
                                    onClick={() => handleRequestAction(club.id, req.userId, "approve")}
                                    className="px-3 py-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md cursor-pointer transition-all shadow-3xs"
                                  >
                                    Duyệt Nhập
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Members Removal / Kick Administration Panel */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-xl p-5 shadow-xs flex flex-col gap-3">
                        <h4 className="text-[10px] uppercase font-black text-rose-500 tracking-wider border-b border-rose-100 dark:border-rose-950/40 pb-2">
                          {language === "en" ? "Roster Administration" : "Bảng Biên Chế Roster VĐV"}
                        </h4>

                        <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-850">
                          {club.members?.map(member => (
                            <div key={member.userId} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                {member.name} {member.userId === currentUser?.uid && "(Bạn)"}
                              </span>
                              
                              {member.userId !== currentUser?.uid && (
                                <button
                                  onClick={() => handleKickMember(member.userId, member.name)}
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg cursor-pointer transition-all"
                                  title="Loại khỏi câu lạc bộ"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Leadership Transfer Panel */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-xl p-5 shadow-xs flex flex-col gap-3">
                        <h4 className="text-[10px] uppercase font-black text-amber-500 tracking-wider">
                          {language === "en" ? "Transfer Leadership" : "Chuyển Nhượng Chức Vụ Trưởng CLB"}
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {language === "en"
                            ? "Hand over all club management permissions to an official roster member. You will automatically become a regular competitor."
                            : "Trao lại quyền Trưởng câu lạc bộ cho một thành viên chính thức. Sau khi chuyển giao, tài khoản của bạn sẽ tự động hạ cấp xuống thành viên thường."}
                        </p>

                        <button
                          onClick={() => setShowTransferModal(true)}
                          className="w-full py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/10 text-amber-600 dark:text-amber-400 border border-amber-200/40 dark:border-amber-900/40 rounded-xl text-xs font-bold cursor-pointer transition-all"
                        >
                          Chuyển giao quyền quản trị
                        </button>
                      </div>

                    </div>
                  )}

                </div>

                {/* Drawer Footer Actions Toolbar */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 shrink-0 border-t border-slate-200 dark:border-slate-850 flex items-center justify-between gap-3">
                  
                  {isMember && (
                    <button
                      onClick={handleLeaveClub}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-200/40 dark:border-rose-900/40 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center gap-1"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      {language === "en" ? "Leave Club" : "Rời Câu Lạc Bộ"}
                    </button>
                  )}

                  {!isMember && !hasPending && (
                    <button
                      onClick={() => handleJoinRequest(club.id)}
                      disabled={!!myClub || !!myPendingRequestClub}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase rounded-xl cursor-pointer shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <PlusCircle className="w-4 h-4 text-white" />
                      {language === "en" ? "Apply to Join" : "Nộp Đơn Gia Nhập"}
                    </button>
                  )}

                  {hasPending && (
                    <button
                      onClick={() => handleWithdrawJoinRequest(club.id)}
                      className="px-5 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200/40 dark:border-red-900/40 text-xs font-black uppercase rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
                    >
                      <Clock className="w-4 h-4 animate-pulse" />
                      {language === "en" ? "Withdraw Application" : "Rút Đơn Đã Nộp"}
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedClub(null)}
                    className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer hover:bg-slate-300 dark:hover:bg-slate-700 transition-all text-center ml-auto"
                  >
                    {language === "en" ? "Close" : "Đóng Lại"}
                  </button>
                </div>

              </div>

              {/* Transfer Leadership Overlay Dialog inside Drawer */}
              {showTransferModal && (
                <div className="fixed inset-0 z-[10006] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 animate-scaleIn">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-amber-500" />
                        {language === "en" ? "Transfer Leadership" : "Xác Nhận Chuyển Giao Quyền"}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {language === "en"
                          ? "Select an official member of the club to take over your administrative authority. This action is irreversible."
                          : "Chọn một thành viên chính thức thuộc danh sách câu lạc bộ để bàn giao quyền Trưởng nhóm. Hành động này không thể hoàn tác."}
                      </p>
                    </div>

                    <form onSubmit={handleTransferLeadership} className="flex flex-col gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          {language === "en" ? "Select Member" : "Chọn thành viên nhận quyền"}
                        </label>
                        <select
                          required
                          value={transferTargetUserId}
                          onChange={(e) => setTransferTargetUserId(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-850 dark:text-white font-bold"
                        >
                          <option value="">-- {language === "en" ? "Select Competitor" : "Chọn Vận Động Viên"} --</option>
                          {club.members
                            ?.filter(m => m.userId !== currentUser?.uid)
                            .map(m => (
                              <option key={m.userId} value={m.userId}>
                                {m.name} ({m.email})
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowTransferModal(false);
                            setTransferTargetUserId("");
                          }}
                          className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 cursor-pointer"
                        >
                          Hủy bỏ
                        </button>
                        <button
                          type="submit"
                          disabled={isTransferring || !transferTargetUserId}
                          className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                        >
                          {isTransferring ? "Đang chuyển..." : "Xác Nhận"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

            </div>
          );
        })(),
        document.body
      )}

      {/* 5. Biography Modal Drawer / Full Details for Selected Athlete Profile */}
      <AthleteProfileModal
        athlete={selectedAthleteProfile}
        isOpen={!!selectedAthleteProfile}
        onClose={() => setSelectedAthleteProfile(null)}
        history={history}
        onlineTournaments={onlineTournaments}
        currentUser={currentUser}
        isGlobalAdmin={userRole === "admin"}
        language={language}
      />

      {/* 2-Step Leave Club Confirmation Modal */}
      {showLeaveClubModalStep > 0 && selectedClub && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-[10010] p-4 animate-fadeIn text-slate-800 dark:text-slate-100">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full shadow-2xl flex flex-col items-center text-center gap-4">
            {showLeaveClubModalStep === 1 ? (
              <>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-full">
                  <AlertTriangle className="w-8 h-8 animate-bounce" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                  {language === "en" ? "Leave Club Request" : "Yêu cầu rời Câu Lạc Bộ"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                  {language === "en" 
                    ? `You are requesting to leave "${selectedClub.name}". Your historical scores and contributions will remain with the club, but you will no longer be an official member.`
                    : `Bạn đang gửi yêu cầu rời khỏi câu lạc bộ "${selectedClub.name}". Mọi kết quả thi đấu lịch sử của bạn vẫn nằm lại CLB, nhưng bạn sẽ không còn là thành viên chính thức.`}
                </p>
                <div className="flex gap-2 w-full mt-2">
                  <button
                    type="button"
                    onClick={() => setShowLeaveClubModalStep(0)}
                    className="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {language === "en" ? "Cancel" : "Hủy bỏ"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLeaveClubModalStep(2)}
                    className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    {language === "en" ? "Continue" : "Tiếp tục"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-full">
                  <LogOut className="w-8 h-8 animate-pulse" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-red-600 dark:text-red-400 uppercase tracking-tight">
                  {language === "en" ? "Final Confirmation" : "Xác nhận lần cuối"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans font-bold">
                  {language === "en"
                    ? "This action is irreversible! You will become a Free Agent immediately. To rejoin this club, you must apply and be approved again."
                    : "Hành động này KHÔNG THỂ HOÀN TÁC! Bạn sẽ ngay lập tức trở thành vận động viên tự do. Muốn tham gia lại câu lạc bộ này, bạn phải nộp đơn xét duyệt từ đầu."}
                </p>
                <div className="flex gap-2 w-full mt-2">
                  <button
                    type="button"
                    onClick={() => setShowLeaveClubModalStep(1)}
                    className="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {language === "en" ? "Back" : "Quay lại"}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmLeaveClubStep2}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    {language === "en" ? "Confirm Leave" : "Xác nhận Rời"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* 2-Step Disband Club Confirmation Modal */}
      {showDisbandClubModalStep > 0 && selectedClub && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-[10010] p-4 animate-fadeIn text-slate-800 dark:text-slate-100">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full shadow-2xl flex flex-col items-center text-center gap-4">
            {showDisbandClubModalStep === 1 ? (
              <>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-full">
                  <AlertTriangle className="w-8 h-8 animate-bounce" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                  {language === "en" ? "Disband Club Request" : "Yêu cầu giải tán Câu Lạc Bộ"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                  {language === "en" 
                    ? `You are requesting to disband "${selectedClub.name}". Disbanding the club will delete it from the system entirely. Are you sure you want to proceed?`
                    : `Bạn đang gửi yêu cầu giải tán câu lạc bộ "${selectedClub.name}". Giải tán câu lạc bộ sẽ xóa hoàn toàn CLB khỏi hệ thống. Bạn có chắc chắn muốn tiếp tục?`}
                </p>
                <div className="flex gap-2 w-full mt-2">
                  <button
                    type="button"
                    onClick={() => setShowDisbandClubModalStep(0)}
                    className="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {language === "en" ? "Cancel" : "Hủy bỏ"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDisbandClubModalStep(2)}
                    className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    {language === "en" ? "Continue" : "Tiếp tục"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-full">
                  <Trash2 className="w-8 h-8 animate-pulse" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-red-600 dark:text-red-400 uppercase tracking-tight">
                  {language === "en" ? "Final Confirmation" : "Xác nhận lần cuối"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans font-bold">
                  {language === "en"
                    ? "This action is absolutely IRREVERSIBLE! The club will be deleted from the system and all association with it will be cleared. This cannot be undone!"
                    : "Hành động này HOÀN TOÀN KHÔNG THỂ HOÀN TÁC! Câu lạc bộ sẽ bị xóa vĩnh viễn khỏi hệ thống và tất cả liên kết sẽ bị xóa sạch."}
                </p>
                <div className="flex gap-2 w-full mt-2">
                  <button
                    type="button"
                    onClick={() => setShowDisbandClubModalStep(1)}
                    className="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {language === "en" ? "Back" : "Quay lại"}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDisbandClubStep2}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    {language === "en" ? "Disband Club" : "Giải Tán CLB"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
