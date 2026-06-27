import React, { useState, useEffect, useMemo } from "react";
import { 
  subscribeToTournamentsList, 
  deleteOnlineTournament,
  createOnlineTournament,
  updateOnlineTournament,
  TournamentData 
} from "../lib/firebaseService";
import { auth } from "../firebase";
import { 
  Trophy, 
  Users, 
  Calendar, 
  Plus, 
  Search, 
  Trash2, 
  User, 
  Play, 
  Heart, 
  ShieldAlert, 
  UserCheck, 
  Lock, 
  Globe,
  RefreshCw,
  Award,
  CircleDot,
  CloudUpload,
  X,
  Share2
} from "lucide-react";
import { Athlete, DistanceConfig } from "../types";
import { getHitCount, calculateRounds } from "../utils/qualification";

interface OnlineTournamentsPanelProps {
  onSelectTournament: (id: string, tournament: TournamentData, targetTab?: string) => void;
  activeHistoryId: string | null;
  // Fallbacks to create from current local setup
  currentSetup: {
    matchName: string;
    competitionMode: "individual" | "team";
    shotsCount: number;
    teamShotsCount: number;
    directMaxPoints?: number;
    teamDirectMaxPoints?: number;
    distances: DistanceConfig[];
    teamDistances: DistanceConfig[];
    athletes: Athlete[];
    teamAthletes: Athlete[];
    inputAthletes: Athlete[];
    teamInputAthletes: Athlete[];
    startDate?: string;
    endDate?: string;
    tournamentType?: "individual" | "team" | "combined";
  };
  onOpenAuthModal: () => void;
  onRedirectToCreateTournament?: () => void;
}

export const OnlineTournamentsPanel: React.FC<OnlineTournamentsPanelProps> = ({
  onSelectTournament,
  activeHistoryId,
  currentSetup,
  onOpenAuthModal,
  onRedirectToCreateTournament
}) => {
  const [tournaments, setTournaments] = useState<TournamentData[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [creating, setCreating] = useState(false);
  const [showConfirmDeleteId, setShowConfirmDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleShare = (tourId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const shareUrl = `${window.location.origin}${window.location.pathname}?tour=${tourId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedId(tourId);
      setTimeout(() => setCopiedId(null), 2500);
    }).catch(err => {
      console.error("Failed to copy link:", err);
    });
  };

  // States for the new safe Cloud Publish Dialog
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [customPublishName, setCustomPublishName] = useState("");

  useEffect(() => {
    if (isPublishModalOpen) {
      setCustomPublishName(currentSetup.matchName.replace(" (Online Cloud)", "").trim());
    }
  }, [isPublishModalOpen, currentSetup.matchName]);

  // Monitor auth state changes in real-time
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Listen to Firestore events list in real-time
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToTournamentsList((list) => {
      setTournaments(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Helper date status parser
  const getTournamentStatus = (startDateStr?: string, endDateStr?: string): "active" | "upcoming" | "ended" => {
    if (!startDateStr) return "active"; // defaults to "đang bắn"
    
    // Parse current date
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Parse start date "YYYY-MM-DD"
    const partsStart = startDateStr.split("-");
    if (partsStart.length !== 3) return "active";
    const start = new Date(Number(partsStart[0]), Number(partsStart[1]) - 1, Number(partsStart[2]));
    
    if (today < start) {
      return "upcoming"; // Sắp diễn ra
    }
    
    if (endDateStr) {
      const partsEnd = endDateStr.split("-");
      if (partsEnd.length === 3) {
        const end = new Date(Number(partsEnd[0]), Number(partsEnd[1]) - 1, Number(partsEnd[2]), 23, 59, 59, 999);
        if (now > end) {
          return "ended"; // Đã kết thúc
        }
      }
    }
    
    return "active"; // Đang diễn ra (đang bắn)
  };

  const statusPriority: Record<string, number> = {
    active: 1,   // đang bắn
    upcoming: 2, // sắp diễn ra
    ended: 3     // đã kết thúc
  };

  // Helper to format date strings in dd/mm/yyyy format from YYYY-MM-DD
  const formatDateDMY = (dateStr?: string): string => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // List of Cloud Tournaments owned or co-managed by the current logged-in user
  const userOwnedTournaments = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.email === "nahnatofficial@gmail.com") return tournaments;
    const email = currentUser.email?.toLowerCase().trim() || "";
    return tournaments.filter(t => 
      t.creatorId === currentUser.uid || 
      t.creatorEmail === currentUser.email ||
      (t.subAdmins && t.subAdmins.some((subEmail: string) => subEmail.toLowerCase().trim() === email))
    );
  }, [tournaments, currentUser]);

  // Filtered and sorted list based on Status priority, then time descending
  const filteredTournaments = useMemo(() => {
    let list = [...tournaments];
    if (search.trim()) {
      const query = search.toLowerCase();
      list = list.filter(t => t.matchName.toLowerCase().includes(query));
    }

    return list.sort((a, b) => {
      const statusA = getTournamentStatus(a.startDate, a.endDate);
      const statusB = getTournamentStatus(b.startDate, b.endDate);

      if (statusPriority[statusA] !== statusPriority[statusB]) {
        return statusPriority[statusA] - statusPriority[statusB];
      }

      // same status, compare updated time/created time descending
      const getTimestamp = (t: TournamentData) => {
        if (t.updatedAt) {
          if (typeof t.updatedAt.toDate === "function") return t.updatedAt.toDate().getTime();
          if (t.updatedAt.seconds) return t.updatedAt.seconds * 1000;
          return new Date(t.updatedAt).getTime();
        }
        if (t.createdAt) {
          if (typeof t.createdAt.toDate === "function") return t.createdAt.toDate().getTime();
          if (t.createdAt.seconds) return t.createdAt.seconds * 1000;
          return new Date(t.createdAt).getTime();
        }
        return 0;
      };

      return getTimestamp(b) - getTimestamp(a);
    });
  }, [tournaments, search]);

  // Helper to calculate total individual score for ranking matching MainDashboard logic
  const getTopAthletes = (tour: TournamentData): { name: string; team: string; score: number }[] => {
    // ALWAYS treat as individual mode for calculating individual top 3
    const isTeam = false;
    const isTeamEnv = tour.tournamentType === "team" || (!tour.athletes || tour.athletes.length === 0);

    const athletes = isTeamEnv ? (tour.teamAthletes || []) : (tour.athletes || []);
    const distances = isTeamEnv ? (tour.teamDistances || tour.distances || []) : (tour.distances || []);
    const shotsCount = isTeamEnv ? (tour.teamShotsCount !== undefined ? tour.teamShotsCount : tour.shotsCount) : tour.shotsCount;
    const directMaxShots = isTeamEnv ? ((tour as any).teamDirectMaxShots) : (tour as any).directMaxShots;
    const directMaxPoints = isTeamEnv ? tour.teamDirectMaxPoints : tour.directMaxPoints;

    if (!athletes || athletes.length === 0 || !distances || distances.length === 0) return [];

    const isDirectMode = shotsCount === 1;
    const effectiveShotsCount = isDirectMode ? (directMaxShots || 10) : shotsCount;

    // Call calculateRounds
    const roundResults = calculateRounds(athletes, distances, effectiveShotsCount, directMaxPoints);

    // Compute athlete survival info exactly like MainDashboard
    const athleteSurvivalInfo = athletes.map((athlete) => {
      let eliminatedInRoundIdx: number | null = null;
      for (let i = 0; i < roundResults.length; i++) {
        if (roundResults[i].eliminatedIds.includes(athlete.id)) {
          let hasSubsequentParticipation = false;
          for (let j = i + 1; j < roundResults.length; j++) {
            if (roundResults[j].qualifiedIds.includes(athlete.id)) {
              hasSubsequentParticipation = true;
              break;
            }
          }
          if (!hasSubsequentParticipation) {
            eliminatedInRoundIdx = i;
            break;
          }
        }
      }

      const survivalVal = eliminatedInRoundIdx === null ? distances.length : eliminatedInRoundIdx;
      const lastActiveRoundIdx = eliminatedInRoundIdx === null ? (distances.length - 1) : eliminatedInRoundIdx;

      let survivalScore = 0;
      let survivalHits = 0;
      let survivalAccuracy = 0;
      let survivalSoloHits = 0;

      const hasMaxRoundScoreConf = distances.some(d => d.isMaxRoundScore);

      if (distances.length > 0 && lastActiveRoundIdx >= 0) {
        if (hasMaxRoundScoreConf) {
          let maxScore = -1;
          let maxHits = 0;
          let maxSoloHits = 0;

          let cumulativeHitsSumInShotRounds = 0;
          let cumulativeScoreSumInShotRounds = 0;
          let cumulativeMultiplierSumInShotRounds = 0;
          let cumulativeCountInShotRounds = 0;

          for (let i = 0; i <= lastActiveRoundIdx; i++) {
            const isQualifiedForRound = i === 0 || roundResults[i]?.qualifiedIds.includes(athlete.id);
            if (isQualifiedForRound) {
              const dist = distances[i];
              const hits = athlete.scores[dist.id] || [];
              const hitCount = getHitCount(hits);
              const score = hitCount * dist.multiplier;

              const wasShot = hits.length > 0 && hits.some(v => v !== null && v !== undefined);
              if (wasShot) {
                cumulativeHitsSumInShotRounds += hitCount;
                cumulativeScoreSumInShotRounds += score;
                cumulativeMultiplierSumInShotRounds += dist.multiplier;
                cumulativeCountInShotRounds++;
              }

              const soloHits = dist.isSolo ? (athlete.soloHits?.[dist.id] || 0) : 0;

              if (score > maxScore) {
                maxScore = score;
                maxHits = hitCount;
                maxSoloHits = soloHits;
              }
            }
          }

          survivalScore = maxScore >= 0 ? maxScore : 0;
          survivalHits = cumulativeHitsSumInShotRounds;

          if (isDirectMode && directMaxPoints !== undefined && directMaxPoints > 0) {
            if (cumulativeMultiplierSumInShotRounds === 0 && distances[lastActiveRoundIdx]) {
              cumulativeMultiplierSumInShotRounds = distances[lastActiveRoundIdx].multiplier;
            }
            const totalPossPoints = directMaxPoints * cumulativeMultiplierSumInShotRounds;
            survivalAccuracy = totalPossPoints > 0 ? (cumulativeScoreSumInShotRounds / totalPossPoints) * 100 : 0;
          } else {
            if (cumulativeCountInShotRounds === 0) {
              cumulativeCountInShotRounds = 1;
            }
            const totalPossShots = cumulativeCountInShotRounds * effectiveShotsCount;
            survivalAccuracy = totalPossShots > 0 ? (cumulativeHitsSumInShotRounds / totalPossShots) * 105 : 0; // wait, let's keep exact formula
            survivalAccuracy = totalPossShots > 0 ? (cumulativeHitsSumInShotRounds / totalPossShots) * 100 : 0;
          }
          survivalSoloHits = maxSoloHits;
        } else {
          const statsAtLastRound = roundResults[lastActiveRoundIdx]?.scores[athlete.id];
          if (statsAtLastRound) {
            survivalScore = statsAtLastRound.cumulativeScore;
            survivalHits = statsAtLastRound.cumulativeHits;
            if (isDirectMode && directMaxPoints !== undefined && directMaxPoints > 0) {
              let totalMultiplier = 0;
              for (let i = 0; i <= lastActiveRoundIdx; i++) {
                const d = distances[i];
                const wasShot = athlete.scores[d.id] && athlete.scores[d.id].length > 0 && athlete.scores[d.id].some(v => v !== null && v !== undefined);
                if (wasShot) {
                  totalMultiplier += d.multiplier;
                }
              }
              if (totalMultiplier === 0 && distances[lastActiveRoundIdx]) {
                totalMultiplier = distances[lastActiveRoundIdx].multiplier;
              }
              const totalPossPoints = directMaxPoints * totalMultiplier;
              survivalAccuracy = totalPossPoints > 0 ? (survivalScore / totalPossPoints) * 100 : 0;
            } else {
              let shotRoundsCount = 0;
              for (let i = 0; i <= lastActiveRoundIdx; i++) {
                const d = distances[i];
                const wasShot = athlete.scores[d.id] && athlete.scores[d.id].length > 0 && athlete.scores[d.id].some(v => v !== null && v !== undefined);
                if (wasShot) {
                  shotRoundsCount++;
                }
              }
              if (shotRoundsCount === 0) {
                shotRoundsCount = 1;
              }
              const totalPossShots = shotRoundsCount * effectiveShotsCount;
              survivalAccuracy = totalPossShots > 0 ? (survivalHits / totalPossShots) * 100 : 0;
            }
          }
          const lastActiveDist = distances[lastActiveRoundIdx];
          if (lastActiveDist && lastActiveDist.isSolo) {
            survivalSoloHits = athlete.soloHits?.[lastActiveDist.id] || 0;
          }
        }
      }

      let totalScore = 0;
      let totalHits = 0;
      let accuracy = 0;

      if (hasMaxRoundScoreConf) {
        let maxScore = -1;
        let cumulativeHitsSumInShotRounds = 0;
        let cumulativeMultiplierSumInShotRounds = 0;
        let cumulativeCountInShotRounds = 0;
        let cumulativeScoreSumInShotRounds = 0;

        distances.forEach((dist) => {
          const hits = athlete.scores[dist.id] || [];
          const hitCount = getHitCount(hits);
          const score = hitCount * dist.multiplier;

          const wasShot = hits.length > 0 && hits.some(v => v !== null && v !== undefined);
          if (wasShot) {
            cumulativeHitsSumInShotRounds += hitCount;
            cumulativeScoreSumInShotRounds += score;
            cumulativeMultiplierSumInShotRounds += dist.multiplier;
            cumulativeCountInShotRounds++;
          }
          if (score > maxScore) {
            maxScore = score;
          }
        });

        totalScore = maxScore >= 0 ? maxScore : 0;
        totalHits = cumulativeHitsSumInShotRounds;

        if (isDirectMode && directMaxPoints !== undefined && directMaxPoints > 0) {
          if (cumulativeMultiplierSumInShotRounds === 0 && distances[0]) {
            cumulativeMultiplierSumInShotRounds = distances[0].multiplier;
          }
          const totalPossiblePoints = directMaxPoints * cumulativeMultiplierSumInShotRounds;
          accuracy = totalPossiblePoints > 0 ? (cumulativeScoreSumInShotRounds / totalPossiblePoints) * 100 : 0;
        } else {
          if (cumulativeCountInShotRounds === 0) cumulativeCountInShotRounds = 1;
          const totalPossShots = cumulativeCountInShotRounds * effectiveShotsCount;
          accuracy = totalPossShots > 0 ? (cumulativeHitsSumInShotRounds / totalPossShots) * 100 : 0;
        }
      } else {
        distances.forEach((dist) => {
          const hits = athlete.scores[dist.id] || [];
          const hitCount = getHitCount(hits);
          totalScore += hitCount * dist.multiplier;
          totalHits += hitCount;
        });

        let totalMultiplierOfShotRounds = 0;
        let countShotRounds = 0;
        distances.forEach((d) => {
          const wasShot = athlete.scores[d.id] && athlete.scores[d.id].length > 0 && athlete.scores[d.id].some(v => v !== null && v !== undefined);
          if (wasShot) {
            totalMultiplierOfShotRounds += d.multiplier;
            countShotRounds++;
          }
        });
        if (countShotRounds === 0 && distances.length > 0) {
          totalMultiplierOfShotRounds = distances[0].multiplier;
          countShotRounds = 1;
        }
        if (isDirectMode && directMaxPoints !== undefined && directMaxPoints > 0) {
          const totalPossiblePoints = directMaxPoints * totalMultiplierOfShotRounds;
          accuracy = totalPossiblePoints > 0 ? (totalScore / totalPossiblePoints) * 100 : 0;
        } else {
          const totalPossShots = countShotRounds * effectiveShotsCount;
          accuracy = totalPossShots > 0 ? (totalHits / totalPossShots) * 100 : 0;
        }
      }

      return {
        ...athlete,
        survivalVal,
        survivalScore,
        survivalHits,
        survivalAccuracy,
        survivalSoloHits,
        totalScore,
        totalHits,
        accuracy,
      };
    });

    const activeList = athleteSurvivalInfo.filter(a => a.status !== "Bỏ thi");
    const showSurvival = distances.some(d => d.isElimination);

    let sorted;
    if (showSurvival) {
      // Sort by survival length first, then score, then shootout soloHits, then accuracy
      sorted = [...activeList].sort((a, b) => {
        // 1. Who survived more rounds
        if (b.survivalVal !== a.survivalVal) {
          return b.survivalVal - a.survivalVal;
        }
        // 2. Cumulative score up to their last active round
        if (b.survivalScore !== a.survivalScore) {
          return b.survivalScore - a.survivalScore;
        }
        // 3. Shootout soloHits in their last active round
        if (b.survivalSoloHits !== a.survivalSoloHits) {
          return b.survivalSoloHits - a.survivalSoloHits;
        }
        if (b.survivalAccuracy !== a.survivalAccuracy) {
          return b.survivalAccuracy - a.survivalAccuracy;
        }
        return a.name.localeCompare(b.name, "vi");
      });
    } else {
      // Sort strictly by total cumulative score, then accuracy
      sorted = [...activeList].sort((a, b) => {
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore;
        }
        if (b.accuracy !== a.accuracy) {
          return b.accuracy - a.accuracy;
        }
        return a.name.localeCompare(b.name, "vi");
      });
    }

    return sorted.slice(0, 3).map(ath => ({
      name: ath.name,
      team: ath.team || "Tự Do",
      score: showSurvival ? ath.survivalScore : ath.totalScore,
    }));
  };

  // Helper to calculate top teams matching TeamLeaderboard.tsx / MainDashboard.tsx exactly
  const getTopTeams = (tour: TournamentData): { name: string; score: number }[] => {
    // ALWAYS treat as team mode for calculating team top 3
    const isTeam = true;
    const isIndividualEnv = tour.tournamentType === "individual" || (!tour.teamAthletes || tour.teamAthletes.length === 0);

    const resolvedTeamAthletes = isIndividualEnv 
      ? (tour.athletes || []) 
      : (tour.teamAthletes || []).filter((a) => a.isPrimaryTeam);

    const activeTeamDistances = isIndividualEnv 
      ? (tour.distances || []) 
      : (tour.teamDistances || tour.distances || []);

    const teamShotsCount = isIndividualEnv 
      ? tour.shotsCount 
      : (tour.teamShotsCount !== undefined ? tour.teamShotsCount : tour.shotsCount);

    const isTeamDirectMode = teamShotsCount === 1;

    const teamDirectMaxShots = isIndividualEnv 
      ? (tour as any).directMaxShots 
      : (tour as any).teamDirectMaxShots;

    const teamDirectMaxPoints = isIndividualEnv 
      ? tour.directMaxPoints 
      : tour.teamDirectMaxPoints;

    if (!resolvedTeamAthletes || resolvedTeamAthletes.length === 0 || !activeTeamDistances || activeTeamDistances.length === 0) return [];

    const activeTeamShotsCount = isTeamDirectMode ? (teamDirectMaxShots || 10) : teamShotsCount;

    // 1. Calculate team round results
    const teamRoundResults: any[] = [];
    const teamCumulativeScores: Record<string, number> = {};
    const teamCumulativeHits: Record<string, number> = {};

    const activeTeams = Array.from(new Set(resolvedTeamAthletes.map((a) => {
      const raw = a.team.trim();
      return raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
    }))) as string[];

    for (let r = 0; r < activeTeamDistances.length; r++) {
      const dist = activeTeamDistances[r];
      const teamRoundScores: Record<string, {
        roundHits: number;
        roundScore: number;
        cumulativeHits: number;
        cumulativeScore: number;
        displayScore: number;
        accuracy: number;
        displayScoreWithSolo: number;
        hasUnshotMember: boolean;
        hasAnySoloEntered: boolean;
        teamSoloHits: number;
      }> = {};

      const currentRoundTeams = Array.from(new Set(resolvedTeamAthletes.map((a) => {
        const raw = a.team.trim();
        return raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
      }))).filter((tName) => activeTeams.includes(tName as string)) as string[];

      currentRoundTeams.forEach((teamName: string) => {
        const members = resolvedTeamAthletes.filter((a) => {
          const raw = a.team.trim();
          const t = raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
          return t === teamName;
        });

        const activeMembers = members.filter(memb => memb.status !== "Bỏ thi");

        // Check if any active sibling has not shot in this round at all
        const hasUnshotMember = activeMembers.some((memb) => {
          const hits = memb.scores[dist.id] || [];
          return !hits || hits.length === 0 || hits.every((v) => v === null || v === undefined);
        });

        let roundHits = 0;
        let totalSoloHits = 0;
        let hasAnySoloEntered = false;

        activeMembers.forEach((memb) => {
          const hits = memb.scores[dist.id] || [];
          roundHits += getHitCount(hits);
          const soloVal = memb.soloHits?.[dist.id];
          if (soloVal !== undefined && soloVal !== null) {
            totalSoloHits += soloVal;
            hasAnySoloEntered = true;
          }
        });

        const roundScore = roundHits * dist.multiplier;
        const prevScore = teamCumulativeScores[teamName] || 0;
        const prevHits = teamCumulativeHits[teamName] || 0;

        const currCumulativeScore = prevScore + roundScore;
        const currCumulativeHits = prevHits + roundHits;

        teamCumulativeScores[teamName] = currCumulativeScore;
        teamCumulativeHits[teamName] = currCumulativeHits;

        const displayScore = dist.isCumulative ? currCumulativeScore : roundScore;
        const displayHits = dist.isCumulative ? currCumulativeHits : roundHits;

        let accuracy = 0;
        if (isTeamDirectMode && teamDirectMaxPoints !== undefined && teamDirectMaxPoints > 0) {
          let totalMultiplier = 0;
          if (dist.isCumulative) {
            for (let i = 0; i <= r; i++) {
              totalMultiplier += activeTeamDistances[i].multiplier;
            }
          } else {
            totalMultiplier = dist.multiplier;
          }
          const totalPossPoints = activeMembers.length * teamDirectMaxPoints * totalMultiplier;
          accuracy = totalPossPoints > 0 ? (displayScore / totalPossPoints) * 100 : 0;
        } else {
          const totalPossShots = activeMembers.length * (dist.isCumulative ? (r + 1) * activeTeamShotsCount : activeTeamShotsCount);
          accuracy = totalPossShots > 0 ? (displayHits / totalPossShots) * 100 : 0;
        }

        const displayScoreWithSolo = displayScore + (totalSoloHits * 0.001);

        teamRoundScores[teamName] = {
          roundHits,
          roundScore,
          cumulativeHits: currCumulativeHits,
          cumulativeScore: currCumulativeScore,
          displayScore,
          accuracy,
          displayScoreWithSolo,
          hasUnshotMember,
          hasAnySoloEntered,
          teamSoloHits: totalSoloHits,
        };
      });

      let nextRoundTeams: string[] = [];
      let currentRoundEliminatedTeams: string[] = [];
      let roundPendingSoloTeams: string[] = [];
      let roundResoloTeams: string[] = [];

      if (dist.isElimination) {
        const sortedTeams = [...currentRoundTeams].sort((tA: string, tB: string) => {
          const scoreA = teamRoundScores[tA]?.displayScoreWithSolo || 0;
          const scoreB = teamRoundScores[tB]?.displayScoreWithSolo || 0;
          if (scoreB !== scoreA) {
            return scoreB - scoreA;
          }
          const accA = teamRoundScores[tA]?.accuracy || 0;
          const accB = teamRoundScores[tB]?.accuracy || 0;
          return accB - accA;
        });

        let N = sortedTeams.length;
        const elimVal = dist.eliminationValue || 0;

        if (dist.eliminationType === "count") {
          N = Math.min(sortedTeams.length, elimVal);
        } else {
          N = Math.max(1, Math.round(sortedTeams.length * (elimVal / 100)));
        }

        if (sortedTeams.length <= N) {
          nextRoundTeams = [...sortedTeams];
          currentRoundEliminatedTeams = [];
        } else {
          const cutoffBaseScore = teamRoundScores[sortedTeams[N - 1]]?.displayScore || 0;

          const sures = sortedTeams.filter((t) => (teamRoundScores[t]?.displayScore || 0) > cutoffBaseScore);
          const contenders = sortedTeams.filter((t) => (teamRoundScores[t]?.displayScore || 0) === cutoffBaseScore);
          const purelyEliminated = sortedTeams.filter((t) => (teamRoundScores[t]?.displayScore || 0) < cutoffBaseScore);

          const slotsLeft = N - sures.length;

          const anyTeamUnfinished = currentRoundTeams.some((t) => teamRoundScores[t]?.hasUnshotMember);

          if (anyTeamUnfinished) {
            nextRoundTeams = [...currentRoundTeams];
            currentRoundEliminatedTeams = [];
          } else {
            if (dist.isSolo && slotsLeft > 0 && slotsLeft < contenders.length) {
              const finishedContendersWithNoSolo = contenders.filter((t) => !teamRoundScores[t]?.hasAnySoloEntered);
              roundPendingSoloTeams = [...finishedContendersWithNoSolo];

              if (finishedContendersWithNoSolo.length > 0) {
                nextRoundTeams = [...sures, ...contenders];
                currentRoundEliminatedTeams = [];
              } else {
                const contendersWithSolo = contenders.map((t) => ({
                  id: t,
                  soloHits: teamRoundScores[t]?.teamSoloHits || 0,
                }));

                contendersWithSolo.sort((a, b) => b.soloHits - a.soloHits);

                const winnerScoreBoundary = contendersWithSolo[slotsLeft - 1].soloHits;
                const loserScoreBoundary = contendersWithSolo[slotsLeft].soloHits;

                if (winnerScoreBoundary === loserScoreBoundary) {
                  const resoloCandidates = contendersWithSolo.filter((c) => c.soloHits === winnerScoreBoundary).map((c) => c.id);
                  roundResoloTeams = resoloCandidates;

                  const surelySoloPassed = contendersWithSolo.filter((c) => c.soloHits > winnerScoreBoundary).map((c) => c.id);
                  const surelySoloFailed = contendersWithSolo.filter((c) => c.soloHits < winnerScoreBoundary).map((c) => c.id);

                  nextRoundTeams = [...sures, ...surelySoloPassed, ...resoloCandidates];
                  currentRoundEliminatedTeams = [...surelySoloFailed, ...purelyEliminated];
                } else {
                  const soloPassed = contendersWithSolo.slice(0, slotsLeft).map((c) => c.id);
                  const soloFailed = contendersWithSolo.slice(slotsLeft).map((c) => c.id);

                  nextRoundTeams = [...sures, ...soloPassed];
                  currentRoundEliminatedTeams = [...soloFailed, ...purelyEliminated];
                }
              }
            } else {
              nextRoundTeams = [...sures, ...contenders];
              currentRoundEliminatedTeams = [...purelyEliminated];
            }
          }
        }
      } else {
        nextRoundTeams = [...currentRoundTeams];
        currentRoundEliminatedTeams = [];
      }

      teamRoundResults.push({
        distance: dist,
        roundIndex: r,
        qualifiedTeams: [...currentRoundTeams],
        eliminatedTeams: currentRoundEliminatedTeams,
        pendingSoloTeams: roundPendingSoloTeams,
        pendingResoloTeams: roundResoloTeams,
        scores: teamRoundScores,
      });

      activeTeams.length = 0;
      activeTeams.push(...nextRoundTeams);
    }

    // 2. Active team scores
    const activeTeamScores: Record<string, number> = {};
    const hasMaxRoundScoreConf = activeTeamDistances.some(d => d.isMaxRoundScore);

    if (hasMaxRoundScoreConf) {
      const teamsList = Array.from(new Set(resolvedTeamAthletes.map((a) => {
        const raw = a.team.trim();
        return raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
      }))) as string[];

      teamsList.forEach((teamName) => {
        const members = resolvedTeamAthletes.filter((a) => {
          const raw = a.team.trim();
          const t = raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
          return t === teamName && a.isPrimaryTeam && a.status !== "Bỏ thi";
        });

        let teamScoreSum = 0;
        let teamSoloSum = 0;

        members.forEach((athlete) => {
          let maxScore = -1;
          let maxSoloHits = 0;

          activeTeamDistances.forEach((distance, rIdx) => {
            const isQualified = rIdx === 0 || (teamRoundResults[rIdx]?.qualifiedTeams.includes(teamName));
            if (isQualified) {
              const hits = athlete.scores[distance.id] || [];
              const hitCount = getHitCount(hits);
              const score = hitCount * distance.multiplier;
              const soloVal = athlete.soloHits?.[distance.id];
              const soloHitsAmt = (soloVal === null || soloVal === undefined) ? 0 : soloVal;

              if (score > maxScore) {
                maxScore = score;
                maxSoloHits = soloHitsAmt;
              }
            }
          });

          teamScoreSum += maxScore >= 0 ? maxScore : 0;
          teamSoloSum += maxSoloHits;
        });

        activeTeamScores[teamName] = teamScoreSum + (teamSoloSum * 0.001);
      });
    } else {
      resolvedTeamAthletes.forEach((athlete) => {
        const rawTeam = athlete.team.trim();
        const teamName = rawTeam === "" ? "VĐV Tự Do (Không Đội)" : rawTeam;

        let personalScore = 0;
        let personalSolo = 0;
        activeTeamDistances.forEach((distance, rIdx) => {
          const isQualified = rIdx === 0 || (teamRoundResults[rIdx]?.qualifiedTeams.includes(teamName));
          if (isQualified) {
            const hits = athlete.scores[distance.id] || [];
            const hitCount = getHitCount(hits);
            personalScore += hitCount * distance.multiplier;

            const soloVal = athlete.soloHits?.[distance.id];
            const soloHitsNum = (soloVal === null || soloVal === undefined) ? 0 : soloVal;
            personalSolo += soloHitsNum;
          }
        });

        activeTeamScores[teamName] = (activeTeamScores[teamName] || 0) + personalScore + (personalSolo * 0.001);
      });
    }

    // 3. Compute exact team survival rankings matching TeamLeaderboard.tsx
    const teamRanks: Record<string, number> = {};
    const teamStats: Record<string, { survivalVal: number; score: number }> = {};
    resolvedTeamAthletes.forEach((ath) => {
      const rawTeam = ath.team.trim();
      const teamName = rawTeam === "" ? "VĐV Tự Do (Không Đội)" : rawTeam;
      if (!teamStats[teamName]) {
        let eliminatedInRoundIdx: number | null = null;
        for (let i = 0; i < teamRoundResults.length; i++) {
          if (teamRoundResults[i].eliminatedTeams.includes(teamName)) {
            eliminatedInRoundIdx = i;
            break;
          }
        }
        const sVal = eliminatedInRoundIdx === null ? activeTeamDistances.length : eliminatedInRoundIdx;
        teamStats[teamName] = {
          survivalVal: sVal,
          score: activeTeamScores[teamName] || 0,
        };
      }
    });

    const teamNames = Object.keys(teamStats);
    teamNames.forEach((tName) => {
      const tStats = teamStats[tName];
      let betterTeamsCount = 0;
      teamNames.forEach((otherName) => {
        if (otherName === tName) return;
        const otherStats = teamStats[otherName];
        let isOtherBetter = false;
        if (otherStats.survivalVal !== tStats.survivalVal) {
          isOtherBetter = otherStats.survivalVal > tStats.survivalVal;
        } else {
          isOtherBetter = otherStats.score > tStats.score;
        }
        if (isOtherBetter) {
          betterTeamsCount++;
        }
      });
      teamRanks[tName] = betterTeamsCount + 1;
    });

    // 4. Team leaderboard data
    const list = Object.keys(teamStats).map((teamName) => {
      const score = Math.floor(activeTeamScores[teamName] || 0);
      return {
        teamName,
        totalScore: score,
      };
    });

    const showSurvival = activeTeamDistances.some(d => d.isElimination);

    const sortedTeams = list.sort((a, b) => {
      if (showSurvival) {
        const rankA = teamRanks[a.teamName] || 999;
        const rankB = teamRanks[b.teamName] || 999;
        if (rankA !== rankB) {
          return rankA - rankB;
        }
      } else {
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore;
        }
      }
      return a.teamName.localeCompare(b.teamName, "vi");
    });

    return sortedTeams.slice(0, 3).map((item) => ({
      name: item.teamName,
      score: item.totalScore,
    }));
  };

  const handlePublishNew = async () => {
    if (!currentUser) return;
    if (!customPublishName.trim()) {
      alert("Vui lòng nhập tên giải đấu!");
      return;
    }
    setCreating(true);
    try {
      const cleanSetupName = customPublishName.trim() + " (Online Cloud)";
      const tourId = await createOnlineTournament(
        cleanSetupName,
        currentUser.uid,
        currentUser.email || "",
        currentSetup
      );
      // Select newly created doc
      const newDoc: TournamentData = {
        id: tourId,
        matchName: cleanSetupName,
        creatorId: currentUser.uid,
        creatorEmail: currentUser.email || "",
        createdAt: new Date(),
        updatedAt: new Date(),
        referees: [],
        isPublic: true,
        ...currentSetup
      };
      onSelectTournament(tourId, newDoc, "settings");
      alert("Đã đăng giải đấu mới thành công lên Cloud!");
      setIsPublishModalOpen(false);
      if (onRedirectToCreateTournament) {
        onRedirectToCreateTournament();
      }
    } catch (err) {
      console.error("Failed to publish tournament online:", err);
      alert("Đường truyền tải lên đám mây bị lỗi. Vui lòng kiểm tra lại mạng!");
    } finally {
      setCreating(false);
    }
  };

  const handleOverwriteExisting = async (id: string, existingMatchName: string) => {
    if (!currentUser) return;
    if (!confirm(`Bạn có chắc chắn muốn GHI ĐÈ toàn bộ thông tin cấu hình và điểm số của giải đấu "${existingMatchName}" trên Cloud bằng dữ liệu hiện tại không? Tất cả điểm số cũ của giải này trên Cloud sẽ bị thay thế.`)) {
      return;
    }
    setCreating(true);
    try {
      const cleanSetupName = currentSetup.matchName.replace(" (Online Cloud)", "").trim() + " (Online Cloud)";
      await updateOnlineTournament(id, {
        ...currentSetup,
        matchName: cleanSetupName,
      });

      const updatedDoc: TournamentData = {
        id,
        ...currentSetup,
        matchName: cleanSetupName,
        creatorId: currentUser.uid,
        creatorEmail: currentUser.email || "",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      onSelectTournament(id, updatedDoc, "home");
      alert("Đã cập nhật ghi đè toàn bộ dữ liệu lên giải đấu đám mây thành công!");
      setIsPublishModalOpen(false);
    } catch (err) {
      console.error("Failed to overwrite tournament online:", err);
      alert("Đường truyền tải lên đám mây bị lỗi. Vui lòng kiểm tra lại mạng!");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteOnlineTournament(id);
      setShowConfirmDeleteId(null);
    } catch (err) {
      console.error(err);
      alert("Không thể xóa giải đấu này hoặc bạn không có đủ quyền hợp lệ.");
    }
  };

  return (
    <div className="flex flex-col gap-5 p-1 sm:p-2 text-slate-800 dark:text-slate-100">
      
      {/* Upper Status Banner & Action */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-101 tracking-tight font-sans">
            TRANG CHỦ GIẢI ĐẤU (CLOUD ACCORD)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans mt-1">
            Đồng bộ bảng điểm trực tuyến thời gian thực. Bất kỳ ai cũng có thể xem trực tuyến kết quả thi đấu nhanh nhất.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 w-full md:w-auto font-sans">
          {currentUser ? (
            <button
              type="button"
              onClick={onRedirectToCreateTournament}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black tracking-wide uppercase shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white animate-pulse" />
              Tạo giải đấu mới 🏆
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black uppercase tracking-wide transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <UserCheck className="w-4 h-4 text-indigo-505 shrink-0" />
              Đăng nhập để tạo giải
            </button>
          )}
        </div>
      </div>

      {/* Database Search Filter & Info */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
        <div className="relative w-full sm:max-w-sm font-sans">
          <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm giải đấu online..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9.5 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-800 dark:text-slate-101"
          />
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1.5 rounded-xl font-sans shrink-0">
          <Globe className="w-3.5 h-3.5 animate-pulse text-indigo-500" />
          <span>Tổng số giải đấu trực tuyến: {tournaments.length}</span>
        </div>
      </div>

      {/* Grid of Tournaments */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 font-sans">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-xs text-slate-500">Đang tải đồng bộ dữ liệu giải đấu online...</p>
        </div>
      ) : filteredTournaments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-6 font-sans">
          <Trophy className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-2.5" />
          <h4 className="text-sm font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Trống / Không cấu hình</h4>
          <p className="text-xs text-slate-400 max-w-xs mt-1">
            Không tìm thấy giải đấu trực tuyến nào. Đăng nhập và nhấp vào "Đăng giải đấu lên Cloud" ở trên để đưa giải đấu nội bộ của bạn trực tuyến!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 font-sans">
          {filteredTournaments.map((tour) => {
            const isActive = activeHistoryId === tour.id;
            const isTeam = tour.competitionMode === "team";
            const activeAthletesList = isTeam ? (tour.teamAthletes || []) : (tour.athletes || []);
            const activeDistancesList = isTeam ? (tour.teamDistances || []) : (tour.distances || []);

            const topAthletes = getTopAthletes(tour);
            const topTeams = getTopTeams(tour);
            const dateStr = tour.createdAt && typeof tour.createdAt.toDate === "function" 
              ? tour.createdAt.toDate().toLocaleDateString("vi-VN", { hour: "2-digit", minute: "2-digit" }) 
              : "Hoạt động gần đây";

            // Determine current user relation
            const isOwner = currentUser && (tour.creatorId === currentUser.uid || currentUser.email === "nahnatofficial@gmail.com");
            const isReferee = currentUser && tour.referees?.includes(currentUser.email || "");

            let roleTag = null;
            if (isOwner) {
              roleTag = (
                <span className="text-[9px] font-black tracking-wider uppercase bg-emerald-500 text-white px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs ring-1 ring-emerald-400">
                  <User className="w-3 h-3" /> Trưởng Giải
                </span>
              );
            } else if (isReferee) {
              roleTag = (
                <span className="text-[9px] font-black tracking-wider uppercase bg-amber-500 text-white px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs ring-1 ring-amber-400">
                  <Award className="w-3 h-3" /> Trọng Tài
                </span>
              );
            } else {
              roleTag = (
                <span className="text-[9px] font-black tracking-wider uppercase bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                  Người Xem
                </span>
              );
            }

            const status = getTournamentStatus(tour.startDate, tour.endDate);
            let statusBadge = null;
            if (status === "active") {
              statusBadge = (
                <span className="text-[9px] font-black tracking-wider uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1.5 ring-1 ring-emerald-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  ĐANG BẮN
                </span>
              );
            } else if (status === "upcoming") {
              statusBadge = (
                <span className="text-[9px] font-black tracking-wider uppercase bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md flex items-center gap-1.5 ring-1 ring-blue-400/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                  SẮP DIỄN RA
                </span>
              );
            } else {
              statusBadge = (
                <span className="text-[9px] font-black tracking-wider uppercase bg-slate-100 dark:bg-slate-850 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                  ĐÃ KẾT THÚC
                </span>
              );
            }

            return (
              <div 
                key={tour.id}
                className={`relative bg-white dark:bg-slate-900 rounded-3xl border transition-all p-5 flex flex-col gap-4 shadow-sm hover:shadow-md ${
                  isActive 
                    ? "border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/10 dark:ring-indigo-500/20" 
                    : "border-slate-200/75 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                {/* Header Information */}
                <div className="flex justify-between items-start gap-2">
                  <div className="flex flex-col gap-1 pr-4">
                    <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {dateStr}
                    </span>
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-101 tracking-tight leading-snug line-clamp-2 mt-0.5">
                      {tour.matchName}
                    </h3>
                    {tour.startDate && (
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded-lg w-fit mt-1 border border-slate-100 dark:border-slate-800/40 inline-flex items-center gap-1">
                        📅 Lịch: {formatDateDMY(tour.startDate)}{tour.endDate ? ` - ${formatDateDMY(tour.endDate)}` : ""}
                      </span>
                    )}
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-1.5 leading-none">
                    {roleTag}
                    {statusBadge}
                  </div>
                </div>

                {/* Top 3 Individual & Team Summaries */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/20 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/20">
                  {/* Top 3 Individuals */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1 text-[11px] font-black text-rose-500 uppercase tracking-wider">
                      <Trophy className="w-3.5 h-3.5" />
                      <span>Cá nhân Top 3</span>
                    </div>

                    {topAthletes.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">Chưa ghi nhận điểm</span>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {topAthletes.map((ath, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="font-extrabold text-slate-700 dark:text-slate-300 truncate max-w-[130px] flex items-center gap-1">
                              <span className="w-4 h-4 rounded-full bg-rose-50 dark:bg-rose-950/30 text-rose-500 flex items-center justify-center text-[10px] scale-90">
                                {idx + 1}
                              </span>
                              {ath.name}
                            </span>
                            <span className="font-mono font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded-sm scale-90">
                              {ath.score}đ
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Top 3 Teams */}
                  <div className="flex flex-col gap-2 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-800 pt-3 sm:pt-0 sm:pl-4">
                    <div className="flex items-center gap-1 text-[11px] font-black text-indigo-500 uppercase tracking-wider">
                      <Users className="w-3.5 h-3.5" />
                      <span>Đồng đội Top 3</span>
                    </div>

                    {topTeams.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">Chưa ghi nhận điểm</span>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {topTeams.map((team, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="font-extrabold text-slate-700 dark:text-slate-300 truncate max-w-[130px] flex items-center gap-1">
                              <span className="w-4 h-4 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-indigo-500 flex items-center justify-center text-[10px] scale-90">
                                {idx + 1}
                              </span>
                              {team.name}
                            </span>
                            <span className="font-mono font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded-sm scale-90">
                              {team.score}đ
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Controls / Selection / Delete */}
                <div className="flex justify-between items-center mt-1">
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <CircleDot className="w-3 h-3 text-indigo-500" />
                    <span>Hình thức: {
                      tour.tournamentType === "combined" 
                        ? "Cá Nhân & Đồng Đội (Kết Hợp)" 
                        : tour.tournamentType === "team"
                        ? "Thi Đồng Đội"
                        : tour.tournamentType === "individual"
                        ? "Thi Cá Nhân"
                        : tour.competitionMode === "team" 
                        ? "Thi Đồng Đội" 
                        : "Thi Cá Nhân"
                    }</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Delete Only Creator */}
                    {isOwner && (
                      <button
                        title="Xóa giải khỏi Cloud"
                        onClick={() => setShowConfirmDeleteId(tour.id)}
                        className="p-2 border border-slate-200 dark:border-slate-800 text-rose-500 hover:text-white hover:bg-rose-600 rounded-xl transition-all cursor-pointer hover:border-transparent shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={(e) => handleShare(tour.id, e)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 border shrink-0 ${
                        copiedId === tour.id
                          ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-slate-300"
                      }`}
                      title="Copy link chia sẻ giải đấu trực tuyến này"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      {copiedId === tour.id ? "Đã copy!" : "Chia sẻ"}
                    </button>

                    <button
                      onClick={() => onSelectTournament(tour.id, tour)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm ${
                        isActive 
                          ? "bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800"
                          : "bg-indigo-600 hover:bg-indigo-700 text-white"
                      }`}
                    >
                      <Play className="w-3 h-3 text-current" />
                      {isActive ? "Đang tham gia" : "Vào giải đấu"}
                    </button>
                  </div>
                </div>

                {/* Inner deletion confirmation pop */}
                {showConfirmDeleteId === tour.id && (
                  <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 flex items-center justify-center p-4 z-50 rounded-3xl animate-fadeIn">
                    <div className="text-center flex flex-col items-center gap-3 max-w-xs">
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-full">
                        <Trash2 className="w-6 h-6 animate-pulse" />
                      </div>
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-101 uppercase tracking-wider">Xóa Giải Đấu Khỏi Cloud?</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Bạn có chắc muốn xóa <strong>{tour.matchName}</strong>? Bản lưu trữ trực tuyến và phân quyền trọng tài liên quan sẽ biến mất vĩnh viễn.
                      </p>
                      <div className="flex gap-2 w-full mt-1">
                        <button
                          onClick={() => setShowConfirmDeleteId(null)}
                          className="flex-1 py-1.5 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          Hủy bỏ
                        </button>
                        <button
                          onClick={() => handleDelete(tour.id)}
                          className="flex-1 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 shadow-sm transition-all active:scale-95 cursor-pointer"
                        >
                          Đồng ý Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog Modal: SAFE SELECTIVE PUBLISH TO CLOUD */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col gap-5 shadow-2xl relative">
            
            {/* Close Button */}
            <button 
              onClick={() => setIsPublishModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 pr-10">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl shrink-0">
                <CloudUpload className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight uppercase">
                  ĐĂNG GIẢI ĐẤU LÊN CLOUD
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Lựa chọn hình thức đăng tải phù hợp để tránh đồng bộ đè dữ liệu trực tuyến ngoài ý muốn.
                </p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex flex-col gap-6 font-sans">
              
              {/* Option 1: Create New */}
              <div className="flex flex-col gap-3.5 bg-slate-50/50 dark:bg-slate-950/20 p-4 border border-slate-100 dark:border-slate-800/80 rounded-2xl">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-black">1</span>
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-101 uppercase tracking-wider">Đăng làm Giải Đấu Trực Tuyến MỚI</h4>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed pr-2">
                  Tạo một giải đấu độc lập hoàn toàn mới trên Cloud. Bảng điểm sẽ có đường link xem online riêng.
                </p>
                
                <div className="flex flex-col gap-1.5 mt-1">
                  <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Tên hiển thị trên Cloud</label>
                  <div className="flex gap-2">
                     <input 
                       type="text"
                       value={customPublishName}
                       onChange={(e) => setCustomPublishName(e.target.value)}
                       placeholder="Nhập tên giải đấu..."
                       className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 font-bold"
                     />
                     <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-3 py-2 text-[11px] font-bold rounded-xl flex items-center shrink-0">
                       (Online Cloud)
                     </span>
                  </div>
                </div>

                <button
                  onClick={handlePublishNew}
                  disabled={creating}
                  className="mt-1.5 w-full sm:w-auto self-end px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold tracking-wide uppercase shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {creating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Xác nhận Đăng Giải Mới
                </button>
              </div>

              {/* Divider */}
              <div className="relative flex items-center justify-center -my-2.5">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200 dark:border-slate-800" />
                </div>
                <span className="relative bg-white dark:bg-slate-900 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">HOẶC GHI ĐÈ GIẢI ĐÃ CÓ</span>
              </div>

              {/* Option 2: Overwrite Existing user owned */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-black">2</span>
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-101 uppercase tracking-wider">Cập Nhật / Ghi Đè Lên Giải Cloud Đang Có</h4>
                </div>
                
                <p className="text-xs text-slate-500 leading-relaxed pr-2">
                  Chọn một trong các giải đấu Cloud dưới đây do bạn làm chủ để ghi đè cấu hình và điểm số hiện tại từ máy lên.
                </p>

                {/* Direct quick overwrite for current active Cloud tournament */}
                {activeHistoryId && activeHistoryId.startsWith("tour-") && (
                  <div className="p-4 bg-amber-500/15 dark:bg-amber-505/5 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        🌟 GIẢI ĐANG HOẠT ĐỘNG
                      </span>
                      <strong className="text-xs font-black text-slate-900 dark:text-slate-101 uppercase">{currentSetup.matchName}</strong>
                      <span className="text-[9px] text-slate-400">ID: {activeHistoryId}</span>
                    </div>
                    <button
                      onClick={() => handleOverwriteExisting(activeHistoryId, currentSetup.matchName)}
                      disabled={creating}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-extrabold uppercase tracking-wide transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Xác nhận ghi đè giải đấu và load ra ngoài trang chủ
                    </button>
                  </div>
                )}

                {userOwnedTournaments.length === 0 ? (
                  <div className="py-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                    <Trophy className="w-6 h-6 mb-1 text-slate-300 dark:text-slate-700" />
                    <span className="text-xs font-bold uppercase tracking-wider">Không tìm thấy giải đấu của bạn trên Cloud</span>
                    <p className="text-[10px] mt-0.5">Thầy cô hãy lựa chọn tạo giải đấu MỚI ở phía trên.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1 border border-slate-150 dark:border-slate-800 rounded-2xl p-2 bg-slate-50/20 dark:bg-slate-950/10">
                    {userOwnedTournaments.map((t) => {
                      const status = getTournamentStatus(t.startDate, t.endDate);
                      let sLabel = "ĐANG BẮN";
                      let sColor = "bg-emerald-500";
                      if (status === "upcoming") {
                        sLabel = "SẮP DIỄN RA";
                        sColor = "bg-blue-500";
                      } else if (status === "ended") {
                        sLabel = "ĐÃ KẾT THÚC";
                        sColor = "bg-slate-400";
                      }

                      return (
                        <div 
                          key={t.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-155 dark:border-slate-800 rounded-xl hover:border-indigo-455 dark:hover:border-indigo-400/30 transition-all shadow-xs"
                        >
                          <div className="flex flex-col gap-1 truncate text-left">
                            <span className="text-xs font-black text-slate-900 dark:text-slate-101 truncate flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${sColor}`} />
                              {t.matchName}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-450 dark:text-slate-400 flex items-center gap-1">
                              {t.startDate ? `📅 Lịch: ${formatDateDMY(t.startDate)}${t.endDate ? ` - ${formatDateDMY(t.endDate)}` : ""}` : `Trạng thái: ${sLabel}`}
                            </span>
                          </div>

                          <button
                            onClick={() => handleOverwriteExisting(t.id, t.matchName)}
                            disabled={creating}
                            className="sm:self-center px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Xác nhận ghi đè giải đấu và load ra ngoài trang chủ
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex justify-end">
              <button
                onClick={() => setIsPublishModalOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-705 dark:text-slate-300 transition-all cursor-pointer"
              >
                Đóng lại
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
