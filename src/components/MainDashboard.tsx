import React, { useState, useMemo, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";
import { Athlete, DistanceConfig, Club } from "../types";
import { VSCLogo, SlingshotIcon } from "./VSCLogo";
import { Trophy, Medal, Award, Star, Users, Target, Zap, Shield, TrendingUp, Tv, Share2 } from "lucide-react";
import { AVATAR_MALE } from "./AthleteManagement";
import { calculateRounds, getHitCount } from "../utils/qualification";

interface MainDashboardProps {
  athletes: Athlete[];
  distances: DistanceConfig[];
  shotsCount: number;
  matchName: string;
  masterAthletes?: Athlete[];
  teamAthletes?: Athlete[];
  teamDistances?: DistanceConfig[];
  teamShotsCount?: number;
  leaderboardTeamAthletes?: Athlete[];
  directMaxShots?: number;
  teamDirectMaxShots?: number;
  directMaxPoints?: number;
  teamDirectMaxPoints?: number;
  tournamentType?: "individual" | "team" | "combined";
  clubs?: Club[];
  onOpenLiveBoard?: () => void;
  onOpenExportModal?: () => void;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({ 
  athletes, 
  distances, 
  shotsCount, 
  matchName, 
  masterAthletes,
  teamAthletes,
  teamDistances,
  teamShotsCount,
  leaderboardTeamAthletes,
  directMaxShots,
  teamDirectMaxShots,
  directMaxPoints,
  teamDirectMaxPoints,
  tournamentType = "combined",
  clubs,
  onOpenLiveBoard,
  onOpenExportModal
}) => {
  const { language, t } = useLanguage();
  // Resolve active source variables based on tournamentType
  const activeAthletesList = useMemo(() => {
    if (tournamentType === "team") {
      return leaderboardTeamAthletes || teamAthletes || athletes;
    }
    return athletes;
  }, [tournamentType, athletes, teamAthletes, leaderboardTeamAthletes]);

  const activeDistances = useMemo(() => {
    if (tournamentType === "team") {
      return teamDistances || distances;
    }
    return distances;
  }, [tournamentType, distances, teamDistances]);

  const activeShotsCountVal = useMemo(() => {
    if (tournamentType === "team") {
      return teamShotsCount !== undefined ? teamShotsCount : shotsCount;
    }
    return shotsCount;
  }, [tournamentType, shotsCount, teamShotsCount]);

  const activeDirectMaxShots = useMemo(() => {
    if (tournamentType === "team") {
      return teamDirectMaxShots !== undefined ? teamDirectMaxShots : (directMaxShots || 10);
    }
    return directMaxShots || 10;
  }, [tournamentType, directMaxShots, teamDirectMaxShots]);

  const activeDirectMaxPoints = useMemo(() => {
    if (tournamentType === "team") {
      return teamDirectMaxPoints;
    }
    return directMaxPoints;
  }, [tournamentType, directMaxPoints, teamDirectMaxPoints]);

  const isDirectMode = activeShotsCountVal === 1;
  const isTeamDirectMode = teamShotsCount === 1;

  const effectiveShotsCount = isDirectMode ? activeDirectMaxShots : activeShotsCountVal;
  const effectiveTeamShotsCount = isTeamDirectMode ? (teamDirectMaxShots || 10) : (teamShotsCount !== undefined ? teamShotsCount : shotsCount);

  const [topXCount, setTopXCount] = useState<number>(10);
  const [dashboardTab, setDashboardTab] = useState<"survival" | "allRound">("survival");
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset current page on display tab or Top X count changes
  useEffect(() => {
    setCurrentPage(1);
  }, [dashboardTab, topXCount]);

  // Keep overall preprocessed stats for highlight counts
  const processedAthletes = useMemo(() => {
    const hasMaxRoundScoreConf = activeDistances.some(d => d.isMaxRoundScore);

    return activeAthletesList.map((athlete) => {
      let totalScore = 0;
      let totalHits = 0;
      let maxScore = -1;

      activeDistances.forEach((dist) => {
        const hits = athlete.scores[dist.id] || [];
        const hitCount = getHitCount(hits);
        const score = hitCount * dist.multiplier;
        totalScore += score;
        totalHits += hitCount;
        if (score > maxScore) {
          maxScore = score;
        }
      });

      let totalMultiplierOfShotRounds = 0;
      let countShotRounds = 0;
      activeDistances.forEach((d) => {
        const wasShot = athlete.scores[d.id] && athlete.scores[d.id].length > 0 && athlete.scores[d.id].some(v => v !== null && v !== undefined);
        if (wasShot) {
          totalMultiplierOfShotRounds += d.multiplier;
          countShotRounds++;
        }
      });

      if (countShotRounds === 0 && activeDistances.length > 0) {
        totalMultiplierOfShotRounds = activeDistances[0].multiplier;
        countShotRounds = 1;
      }

      const totalPossShots = countShotRounds * effectiveShotsCount;
      let accuracy = 0;
      if (isDirectMode && activeDirectMaxPoints !== undefined && activeDirectMaxPoints > 0) {
        const totalPossiblePoints = activeDirectMaxPoints * totalMultiplierOfShotRounds;
        accuracy = totalPossiblePoints > 0 ? (totalScore / totalPossiblePoints) * 100 : 0;
      } else {
        accuracy = totalPossShots > 0 ? (totalHits / totalPossShots) * 100 : 0;
      }

      const finalScore = hasMaxRoundScoreConf ? (maxScore >= 0 ? maxScore : 0) : totalScore;
      const finalPossibleShots = isDirectMode && activeDirectMaxPoints !== undefined && activeDirectMaxPoints > 0
        ? activeDirectMaxPoints * totalMultiplierOfShotRounds
        : totalPossShots;

      return {
        ...athlete,
        totalScore: finalScore,
        totalHits,
        totalPossibleShots: finalPossibleShots,
        accuracy,
      };
    });
  }, [activeAthletesList, activeDistances, effectiveShotsCount, isDirectMode, activeDirectMaxPoints]);

  const teamStats = useMemo(() => {
    const teamsMap: Record<string, {
      teamName: string;
      totalScore: number;
      totalHits: number;
      totalShots: number;
      memberCount: number;
    }> = {};

    processedAthletes.forEach((athlete) => {
      const rawTeam = athlete.team.trim();
      const teamName = rawTeam === "" ? "VĐV Tự Do" : rawTeam;

      if (!teamsMap[teamName]) {
        teamsMap[teamName] = {
          teamName,
          totalScore: 0,
          totalHits: 0,
          totalShots: 0,
          memberCount: 0,
        };
      }

      teamsMap[teamName].totalScore += athlete.totalScore;
      teamsMap[teamName].totalHits += athlete.totalHits;
      teamsMap[teamName].totalShots += athlete.totalPossibleShots;
      teamsMap[teamName].memberCount += 1;
    });

    const list = Object.values(teamsMap);
    return list.sort((a, b) => b.totalScore - a.totalScore);
  }, [processedAthletes]);

  // Compute round by round results to establish survival indices
  const athleteSurvivalInfo = useMemo(() => {
    const roundResults = calculateRounds(activeAthletesList, activeDistances, effectiveShotsCount, activeDirectMaxPoints);
    
    return activeAthletesList.map((athlete) => {
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

      const survivalVal = eliminatedInRoundIdx === null ? activeDistances.length : eliminatedInRoundIdx;
      const lastActiveRoundIdx = eliminatedInRoundIdx === null ? (activeDistances.length - 1) : eliminatedInRoundIdx;

      let survivalScore = 0;
      let survivalHits = 0;
      let survivalAccuracy = 0;
      let survivalSoloHits = 0;

      const hasMaxRoundScoreConf = activeDistances.some(d => d.isMaxRoundScore);

      if (activeDistances.length > 0 && lastActiveRoundIdx >= 0) {
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
              const dist = activeDistances[i];
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

          if (isDirectMode && activeDirectMaxPoints !== undefined && activeDirectMaxPoints > 0) {
            if (cumulativeMultiplierSumInShotRounds === 0 && activeDistances[lastActiveRoundIdx]) {
              cumulativeMultiplierSumInShotRounds = activeDistances[lastActiveRoundIdx].multiplier;
            }
            const totalPossPoints = activeDirectMaxPoints * cumulativeMultiplierSumInShotRounds;
            survivalAccuracy = totalPossPoints > 0 ? (cumulativeScoreSumInShotRounds / totalPossPoints) * 100 : 0;
          } else {
            if (cumulativeCountInShotRounds === 0) {
              cumulativeCountInShotRounds = 1;
            }
            const totalPossShots = cumulativeCountInShotRounds * effectiveShotsCount;
            survivalAccuracy = totalPossShots > 0 ? (cumulativeHitsSumInShotRounds / totalPossShots) * 100 : 0;
          }
          survivalSoloHits = maxSoloHits;
        } else {
          const statsAtLastRound = roundResults[lastActiveRoundIdx]?.scores[athlete.id];
          if (statsAtLastRound) {
            survivalScore = statsAtLastRound.cumulativeScore;
            survivalHits = statsAtLastRound.cumulativeHits;
            if (isDirectMode && activeDirectMaxPoints !== undefined && activeDirectMaxPoints > 0) {
              let totalMultiplier = 0;
              for (let i = 0; i <= lastActiveRoundIdx; i++) {
                const d = activeDistances[i];
                const wasShot = athlete.scores[d.id] && athlete.scores[d.id].length > 0 && athlete.scores[d.id].some(v => v !== null && v !== undefined);
                if (wasShot) {
                  totalMultiplier += d.multiplier;
                }
              }
              if (totalMultiplier === 0 && activeDistances[lastActiveRoundIdx]) {
                totalMultiplier = activeDistances[lastActiveRoundIdx].multiplier;
              }
              const totalPossPoints = activeDirectMaxPoints * totalMultiplier;
              survivalAccuracy = totalPossPoints > 0 ? (survivalScore / totalPossPoints) * 100 : 0;
            } else {
              let shotRoundsCount = 0;
              for (let i = 0; i <= lastActiveRoundIdx; i++) {
                const d = activeDistances[i];
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
          const lastActiveDist = activeDistances[lastActiveRoundIdx];
          if (lastActiveDist && lastActiveDist.isSolo) {
            survivalSoloHits = athlete.soloHits?.[lastActiveDist.id] || 0;
          }
        }
      }

      let totalScore = 0;
      let totalHits = 0;
      activeDistances.forEach((dist) => {
        const hits = athlete.scores[dist.id] || [];
        const hitCount = getHitCount(hits);
        totalScore += hitCount * dist.multiplier;
        totalHits += hitCount;
      });

      let accuracy = 0;
      let totalMultiplierOfShotRounds = 0;
      let countShotRounds = 0;
      activeDistances.forEach((d) => {
        const wasShot = athlete.scores[d.id] && athlete.scores[d.id].length > 0 && athlete.scores[d.id].some(v => v !== null && v !== undefined);
        if (wasShot) {
          totalMultiplierOfShotRounds += d.multiplier;
          countShotRounds++;
        }
      });
      if (countShotRounds === 0 && activeDistances.length > 0) {
        totalMultiplierOfShotRounds = activeDistances[0].multiplier;
        countShotRounds = 1;
      }
      if (isDirectMode && activeDirectMaxPoints !== undefined && activeDirectMaxPoints > 0) {
        const totalPossiblePoints = activeDirectMaxPoints * totalMultiplierOfShotRounds;
        accuracy = totalPossiblePoints > 0 ? (totalScore / totalPossiblePoints) * 100 : 0;
      } else {
        const totalPossShots = countShotRounds * effectiveShotsCount;
        accuracy = totalPossShots > 0 ? (totalHits / totalPossShots) * 100 : 0;
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
        eliminatedInRoundIdx,
      };
    });
  }, [activeAthletesList, activeDistances, effectiveShotsCount, isDirectMode, activeDirectMaxPoints]);

  // Sort by survival length first, then score, then shootout soloHits, then accuracy
  const sortedSurvivalAthletes = useMemo(() => {
    return [...athleteSurvivalInfo].sort((a, b) => {
      const isABỏThi = a.status === "Bỏ thi";
      const isBBỏThi = b.status === "Bỏ thi";
      if (isABỏThi && !isBBỏThi) return 1;
      if (!isABỏThi && isBBỏThi) return -1;

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
      // 4. Accuracy up to their last active round
      if (b.survivalAccuracy !== a.survivalAccuracy) {
        return b.survivalAccuracy - a.survivalAccuracy;
      }
      return a.name.localeCompare(b.name, "vi");
    });
  }, [athleteSurvivalInfo]);

  // Sort strictly by cumulative score, then accuracy
  const sortedAllRoundAthletes = useMemo(() => {
    return [...athleteSurvivalInfo].sort((a, b) => {
      const isABỏThi = a.status === "Bỏ thi";
      const isBBỏThi = b.status === "Bỏ thi";
      if (isABỏThi && !isBBỏThi) return 1;
      if (!isABỏThi && isBBỏThi) return -1;

      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      return b.accuracy - a.accuracy;
    });
  }, [athleteSurvivalInfo]);

  // Assign joint ranks for survival list
  const rankedSurvivalAthletes = useMemo(() => {
    return sortedSurvivalAthletes.map((athlete, idx) => {
      let betterCount = 0;
      for (let j = 0; j < idx; j++) {
        const other = sortedSurvivalAthletes[j];
        if (other.status === "Bỏ thi") continue;
        if (athlete.status === "Bỏ thi") continue;

        // Compare by same criteria as the sort: survivalVal, survivalScore, survivalSoloHits, survivalAccuracy
        if (other.survivalVal !== athlete.survivalVal) {
          if (other.survivalVal > athlete.survivalVal) betterCount++;
        } else if (other.survivalScore !== athlete.survivalScore) {
          if (other.survivalScore > athlete.survivalScore) betterCount++;
        } else if (other.survivalSoloHits !== athlete.survivalSoloHits) {
          if (other.survivalSoloHits > athlete.survivalSoloHits) betterCount++;
        } else if (other.survivalAccuracy !== athlete.survivalAccuracy) {
          if (other.survivalAccuracy > athlete.survivalAccuracy) betterCount++;
        }
      }
      return { ...athlete, dashboardRank: betterCount + 1 };
    });
  }, [sortedSurvivalAthletes]);

  // Assign joint ranks for all-round list
  const rankedAllRoundAthletes = useMemo(() => {
    return sortedAllRoundAthletes.map((athlete, idx) => {
      let betterCount = 0;
      for (let j = 0; j < idx; j++) {
        const other = sortedAllRoundAthletes[j];
        if (other.status === "Bỏ thi") continue;
        if (athlete.status === "Bỏ thi") continue;

        if (other.totalScore !== athlete.totalScore) {
          if (other.totalScore > athlete.totalScore) betterCount++;
        } else if (other.accuracy !== athlete.accuracy) {
          if (other.accuracy > athlete.accuracy) betterCount++;
        }
      }
      return { ...athlete, dashboardRank: betterCount + 1 };
    });
  }, [sortedAllRoundAthletes]);

  // Top 3 Survival individual list (matching Bảng Vàng Danh Dự Liveboard logic exactly)
  const top3SurvivalAthletes = useMemo(() => {
    const list = rankedSurvivalAthletes.filter(a => a.status !== "Bỏ thi");
    const matched: any[] = [];

    const gold = list[0];
    matched.push(gold ? { ...gold, displayScore: gold.survivalScore, displayAccuracy: gold.survivalAccuracy } : {
      id: `empty-0`,
      name: "Chưa Có VĐV",
      team: "Tự Do",
      scores: {},
      avatarUrl: "",
      gender: "male" as const,
      note: "",
      registeredForCup: false,
      isPrimaryTeam: false,
      totalScore: 0,
      totalHits: 0,
      accuracy: 0,
      displayScore: 0,
      displayAccuracy: 0,
    });

    const silver = list[1];
    matched.push(silver ? { ...silver, displayScore: silver.survivalScore, displayAccuracy: silver.survivalAccuracy } : {
      id: `empty-1`,
      name: "Chưa Có VĐV",
      team: "Tự Do",
      scores: {},
      avatarUrl: "",
      gender: "male" as const,
      note: "",
      registeredForCup: false,
      isPrimaryTeam: false,
      totalScore: 0,
      totalHits: 0,
      accuracy: 0,
      displayScore: 0,
      displayAccuracy: 0,
    });

    const bronze = list[2];
    matched.push(bronze ? { ...bronze, displayScore: bronze.survivalScore, displayAccuracy: bronze.survivalAccuracy } : {
      id: `empty-2`,
      name: "Chưa Có VĐV",
      team: "Tự Do",
      scores: {},
      avatarUrl: "",
      gender: "male" as const,
      note: "",
      registeredForCup: false,
      isPrimaryTeam: false,
      totalScore: 0,
      totalHits: 0,
      accuracy: 0,
      displayScore: 0,
      displayAccuracy: 0,
    });

    return matched;
  }, [rankedSurvivalAthletes]);

  // Top 3 All-round individual list
  const top3AllRoundAthletes = useMemo(() => {
    const list = rankedAllRoundAthletes.filter(a => a.status !== "Bỏ thi");
    const matched: any[] = [];

    const gold = list[0];
    matched.push(gold ? { ...gold, displayScore: gold.totalScore, displayAccuracy: gold.accuracy } : {
      id: `empty-0`,
      name: "Chưa Có VĐV",
      team: "Tự Do",
      scores: {},
      avatarUrl: "",
      gender: "male" as const,
      note: "",
      registeredForCup: false,
      isPrimaryTeam: false,
      totalScore: 0,
      totalHits: 0,
      accuracy: 0,
      displayScore: 0,
      displayAccuracy: 0,
    });

    const silver = list[1];
    matched.push(silver ? { ...silver, displayScore: silver.totalScore, displayAccuracy: silver.accuracy } : {
      id: `empty-1`,
      name: "Chưa Có VĐV",
      team: "Tự Do",
      scores: {},
      avatarUrl: "",
      gender: "male" as const,
      note: "",
      registeredForCup: false,
      isPrimaryTeam: false,
      totalScore: 0,
      totalHits: 0,
      accuracy: 0,
      displayScore: 0,
      displayAccuracy: 0,
    });

    const bronze = list[2];
    matched.push(bronze ? { ...bronze, displayScore: bronze.totalScore, displayAccuracy: bronze.accuracy } : {
      id: `empty-2`,
      name: "Chưa Có VĐV",
      team: "Tự Do",
      scores: {},
      avatarUrl: "",
      gender: "male" as const,
      note: "",
      registeredForCup: false,
      isPrimaryTeam: false,
      totalScore: 0,
      totalHits: 0,
      accuracy: 0,
      displayScore: 0,
      displayAccuracy: 0,
    });

    return matched;
  }, [rankedAllRoundAthletes]);

  // 1. Resolve source athletes for team calculation based on team environment props
  const resolvedTeamAthletes = useMemo(() => {
    if (tournamentType === "individual") {
      return activeAthletesList; // use individual list, no isPrimaryTeam filter
    }
    const source = leaderboardTeamAthletes || teamAthletes || athletes;
    return source.filter((a) => a.isPrimaryTeam);
  }, [leaderboardTeamAthletes, teamAthletes, athletes, activeAthletesList, tournamentType]);

  const activeTeamDistances = useMemo(() => {
    if (tournamentType === "individual") {
      return activeDistances;
    }
    return teamDistances || distances;
  }, [tournamentType, activeDistances, teamDistances, distances]);

  const activeTeamShotsCount = useMemo(() => {
    if (tournamentType === "individual") {
      return effectiveShotsCount;
    }
    return effectiveTeamShotsCount;
  }, [tournamentType, effectiveShotsCount, effectiveTeamShotsCount]);

  // 2. Compute qualifications and rounds results matching the Team competition mode
  const teamRoundResults = useMemo(() => {
    const results: any[] = [];
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

      results.push({
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

    return results;
  }, [resolvedTeamAthletes, activeTeamDistances, activeTeamShotsCount]);

  // 3. Compute active team scores matching direct qualifiers round results
  const activeTeamScores = useMemo(() => {
    const scores: Record<string, number> = {};
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

        scores[teamName] = teamScoreSum + (teamSoloSum * 0.001);
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

        scores[teamName] = (scores[teamName] || 0) + personalScore + (personalSolo * 0.001);
      });
    }
    return scores;
  }, [resolvedTeamAthletes, activeTeamDistances, teamRoundResults]);

  // 4. Compute exact team survival rankings matching TeamLeaderboard.tsx
  const teamRanks = useMemo(() => {
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
    const ranks: Record<string, number> = {};
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
      ranks[tName] = betterTeamsCount + 1;
    });
    return ranks;
  }, [resolvedTeamAthletes, teamRoundResults, activeTeamScores, activeTeamDistances.length]);

  // 5. Compute exact team cumulative (all round) rankings matching TeamLeaderboard.tsx
  const teamRanksAllRound = useMemo(() => {
    const teamStats: Record<string, { score: number }> = {};
    const hasMaxRoundScoreConf = activeTeamDistances.some(d => d.isMaxRoundScore);

    resolvedTeamAthletes.forEach((ath) => {
      const rawTeam = ath.team.trim();
      const teamName = rawTeam === "" ? "VĐV Tự Do (Không Đội)" : rawTeam;
      if (!teamStats[teamName]) {
        let totalScoreAll = 0;
        const members = resolvedTeamAthletes.filter((a) => {
          const r = a.team.trim();
          const t = r === "" ? "VĐV Tự Do (Không Đội)" : r;
          return t === teamName && a.isPrimaryTeam && a.status !== "Bỏ thi";
        });

        if (hasMaxRoundScoreConf) {
          let teamScoreSum = 0;
          members.forEach((memb) => {
            let memberMaxScore = -1;
            activeTeamDistances.forEach((dist, rIdx) => {
              const isQualified = rIdx === 0 || (teamRoundResults[rIdx]?.qualifiedTeams.includes(teamName));
              if (isQualified) {
                const hits = memb.scores[dist.id] || [];
                const hitCount = getHitCount(hits);
                const score = hitCount * dist.multiplier;
                if (score > memberMaxScore) {
                  memberMaxScore = score;
                }
              }
            });
            teamScoreSum += memberMaxScore >= 0 ? memberMaxScore : 0;
          });
          totalScoreAll = teamScoreSum;
        } else {
          members.forEach((memb) => {
            activeTeamDistances.forEach((dist) => {
              const hits = memb.scores[dist.id] || [];
              const hitCount = getHitCount(hits);
              totalScoreAll += hitCount * dist.multiplier;
            });
          });
        }
        teamStats[teamName] = { score: totalScoreAll };
      }
    });

    const teamNames = Object.keys(teamStats);
    const ranks: Record<string, number> = {};
    teamNames.forEach((tName) => {
      const tStats = teamStats[tName];
      let betterTeamsCount = 0;
      teamNames.forEach((otherName) => {
        if (otherName === tName) return;
        const otherStats = teamStats[otherName];
        if (otherStats.score > tStats.score) {
          betterTeamsCount++;
        }
      });
      ranks[tName] = betterTeamsCount + 1;
    });
    return ranks;
  }, [resolvedTeamAthletes, activeTeamDistances, teamRoundResults]);

  // Unified helper function to compute team scores and rankings exactly like TeamLeaderboard.tsx
  const computeDashboardTeamData = (
    rawAthletes: any[],
    targetDistances: any[],
    targetShotsCount: number,
    competitionMode: "individual" | "team",
    activeTab: "survival" | "allRound",
    directShots?: number,
    teamDirectShots?: number,
    directPoints?: number,
    teamDirectPoints?: number
  ) => {
    const isDirectMode = targetShotsCount === 1;
    const effectiveShotsCount = isDirectMode
      ? (competitionMode === "team" ? (teamDirectShots || 10) : (directShots || 10))
      : targetShotsCount;

    const effectiveDirectMaxPoints = competitionMode === "team" ? teamDirectPoints : directPoints;
    const isPointModeActive = isDirectMode && effectiveDirectMaxPoints !== undefined && effectiveDirectMaxPoints > 0;

    // activeAthletes is standard filtered list
    const activeAthletes = rawAthletes.filter((a) => a.isPrimaryTeam);

    let activeAthletesForCalculation = [];
    if (competitionMode === "team") {
      activeAthletesForCalculation = rawAthletes.filter((a) => a.isPrimaryTeam);
    } else {
      if (activeTab === "survival") {
        activeAthletesForCalculation = rawAthletes.filter((a) => a.isPrimaryTeam);
      } else {
        activeAthletesForCalculation = rawAthletes;
      }
    }

    const roundResults = calculateRounds(activeAthletes, targetDistances, effectiveShotsCount, effectiveDirectMaxPoints);

    const teamRoundResults: any[] = [];
    const activeTeams = Array.from(new Set(activeAthletes.map((a) => {
      const raw = a.team.trim();
      return raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
    }))) as string[];

    for (let r = 0; r < targetDistances.length; r++) {
      const dist = targetDistances[r];
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

      const currentRoundTeams = Array.from(new Set(activeAthletes.map((a) => {
        const raw = a.team.trim();
        return raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
      }))).filter((tName) => activeTeams.includes(tName as string)) as string[];

      currentRoundTeams.forEach((teamName: string) => {
        const members = activeAthletes.filter((a) => {
          const raw = a.team.trim();
          const t = raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
          return t === teamName;
        });

        const activeMembers = members.filter(memb => memb.status !== "Bỏ thi");

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
        const prevRoundStats = r > 0 ? teamRoundResults[r - 1]?.scores[teamName] : null;
        const cumulativeHits = (prevRoundStats?.cumulativeHits || 0) + roundHits;
        const cumulativeScore = (prevRoundStats?.cumulativeScore || 0) + roundScore;
        const displayScore = cumulativeScore;

        let accuracy = 0;
        if (isPointModeActive && effectiveDirectMaxPoints !== undefined) {
          let totalMultiplierSum = 0;
          for (let i = 0; i <= r; i++) {
            totalMultiplierSum += targetDistances[i].multiplier;
          }
          const totalPossPoints = effectiveDirectMaxPoints * totalMultiplierSum * activeMembers.length;
          accuracy = totalPossPoints > 0 ? (cumulativeScore / totalPossPoints) * 100 : 0;
        } else {
          const totalPossShots = (r + 1) * effectiveShotsCount * activeMembers.length;
          accuracy = totalPossShots > 0 ? (cumulativeHits / totalPossShots) * 100 : 0;
        }

        teamRoundScores[teamName] = {
          roundHits,
          roundScore,
          cumulativeHits,
          cumulativeScore,
          displayScore,
          accuracy,
          displayScoreWithSolo: cumulativeScore + (totalSoloHits * 0.001),
          hasUnshotMember,
          hasAnySoloEntered,
          teamSoloHits: totalSoloHits,
        };
      });

      const scoresArray = Object.entries(teamRoundScores).map(([name, val]) => ({
        teamName: name,
        score: val.displayScoreWithSolo,
      }));

      const sortedByScore = [...scoresArray].sort((a, b) => b.score - a.score);
      const sortedNames = sortedByScore.map(item => item.teamName);

      let qualifiedTeams: string[] = [];
      let eliminatedTeams: string[] = [];

      if (competitionMode === "team") {
        const qLimit = dist.teamEliminationLimit ?? 0;
        if (qLimit > 0) {
          qualifiedTeams = sortedNames.slice(0, qLimit);
          eliminatedTeams = sortedNames.slice(qLimit);
        } else {
          const prevQualified = r > 0 ? teamRoundResults[r - 1].qualifiedTeams : activeTeams;
          qualifiedTeams = [...prevQualified];
        }
      } else {
        qualifiedTeams = [...activeTeams];
      }

      teamRoundResults.push({
        roundId: dist.id,
        scores: teamRoundScores,
        qualifiedTeams,
        eliminatedTeams,
      });
    }

    const athleteSurvivalMap: Record<string, {
      eliminatedInRoundIdx: number | null;
      survivalVal: number;
      survivalScore: number;
      survivalHits: number;
      survivalShots?: number;
      survivalAccuracy: number;
    }> = {};

    const hasMaxRoundScoreConf = targetDistances.some(d => d.isMaxRoundScore);

    activeAthletes.forEach((athlete) => {
      const raw = athlete.team.trim();
      const teamName = raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
      let eliminatedInRoundIdx: number | null = null;
      for (let i = 0; i < teamRoundResults.length; i++) {
        if (teamRoundResults[i].eliminatedTeams.includes(teamName)) {
          eliminatedInRoundIdx = i;
          break;
        }
      }

      const survivalVal = eliminatedInRoundIdx === null ? targetDistances.length : eliminatedInRoundIdx;
      const lastActiveRoundIdx = eliminatedInRoundIdx === null ? (targetDistances.length - 1) : eliminatedInRoundIdx;

      let survivalScore = 0;
      let survivalHits = 0;
      let survivalAccuracy = 0;

      if (targetDistances.length > 0 && lastActiveRoundIdx >= 0) {
        if (hasMaxRoundScoreConf) {
          let maxScore = -1;
          let maxHits = 0;
          let maxAccuracy = 0;

          let cumulativeHitsSumInShotRounds = 0;
          let cumulativeScoreSumInShotRounds = 0;
          let cumulativeMultiplierSumInShotRounds = 0;
          let cumulativeCountInShotRounds = 0;

          for (let i = 0; i <= lastActiveRoundIdx; i++) {
            const dist = targetDistances[i];
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

            let accuracy = 0;
            if (isPointModeActive && effectiveDirectMaxPoints !== undefined) {
              const totalPossPoints = effectiveDirectMaxPoints * dist.multiplier;
              accuracy = totalPossPoints > 0 ? (score / totalPossPoints) * 100 : 0;
            } else {
              accuracy = effectiveShotsCount > 0 ? (hitCount / effectiveShotsCount) * 100 : 0;
            }

            if (score > maxScore) {
              maxScore = score;
              maxHits = hitCount;
              maxAccuracy = accuracy;
            }
          }

          survivalScore = maxScore >= 0 ? maxScore : 0;
          survivalHits = cumulativeHitsSumInShotRounds;
          let calculatedPossShots = 0;
          if (isPointModeActive && effectiveDirectMaxPoints !== undefined) {
            if (cumulativeMultiplierSumInShotRounds === 0 && targetDistances[lastActiveRoundIdx]) {
              cumulativeMultiplierSumInShotRounds = targetDistances[lastActiveRoundIdx].multiplier;
            }
            const totalPossPoints = effectiveDirectMaxPoints * cumulativeMultiplierSumInShotRounds;
            calculatedPossShots = totalPossPoints;
            survivalAccuracy = totalPossPoints > 0 ? (cumulativeScoreSumInShotRounds / totalPossPoints) * 100 : 0;
          } else {
            if (cumulativeCountInShotRounds === 0) {
              cumulativeCountInShotRounds = 1;
            }
            const totalPossShots = cumulativeCountInShotRounds * effectiveShotsCount;
            calculatedPossShots = totalPossShots;
            survivalAccuracy = totalPossShots > 0 ? (cumulativeHitsSumInShotRounds / totalPossShots) * 100 : 0;
          }
          athleteSurvivalMap[athlete.id] = {
            eliminatedInRoundIdx,
            survivalVal,
            survivalScore,
            survivalHits,
            survivalShots: calculatedPossShots,
            survivalAccuracy,
          };
        } else {
          const statsAtLastRound = roundResults[lastActiveRoundIdx]?.scores[athlete.id];
          if (statsAtLastRound) {
            survivalScore = statsAtLastRound.cumulativeScore;
            survivalHits = statsAtLastRound.cumulativeHits;
            let calculatedPossShots = 0;
            if (isPointModeActive && effectiveDirectMaxPoints !== undefined) {
              let totalMultiplier = 0;
              for (let i = 0; i <= lastActiveRoundIdx; i++) {
                totalMultiplier += targetDistances[i].multiplier;
              }
              const totalPossPoints = effectiveDirectMaxPoints * totalMultiplier;
              calculatedPossShots = totalPossPoints;
              survivalAccuracy = totalPossPoints > 0 ? (survivalScore / totalPossPoints) * 100 : 0;
            } else {
              const totalPossShots = (lastActiveRoundIdx + 1) * effectiveShotsCount;
              calculatedPossShots = totalPossShots;
              survivalAccuracy = totalPossShots > 0 ? (survivalHits / totalPossShots) * 100 : 0;
            }
            athleteSurvivalMap[athlete.id] = {
              eliminatedInRoundIdx,
              survivalVal,
              survivalScore,
              survivalHits,
              survivalShots: calculatedPossShots,
              survivalAccuracy,
            };
          }
        }
      }
    });

    const activeTeamScores: Record<string, number> = {};
    if (hasMaxRoundScoreConf) {
      const teamsList = Array.from(new Set(activeAthletes.map((a) => {
        const raw = a.team.trim();
        return raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
      }))) as string[];

      teamsList.forEach((teamName) => {
        const members = activeAthletes.filter((a) => {
          const raw = a.team.trim();
          const t = raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
          return t === teamName && a.status !== "Bỏ thi";
        });

        let teamScoreSum = 0;
        let teamSoloSum = 0;

        members.forEach((ath) => {
          let maxScore = -1;
          let maxSoloHits = 0;

          targetDistances.forEach((distance, rIdx) => {
            const isQualified = rIdx === 0 || (teamRoundResults[rIdx]?.qualifiedTeams.includes(teamName));
            if (isQualified) {
              const hits = ath.scores[distance.id] || [];
              const hitCount = getHitCount(hits);
              const score = hitCount * distance.multiplier;
              const soloVal = ath.soloHits?.[distance.id];
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
      activeAthletes.forEach((ath) => {
        const rawTeam = ath.team.trim();
        const teamName = rawTeam === "" ? "VĐV Tự Do (Không Đội)" : rawTeam;

        let personalScore = 0;
        let personalSolo = 0;
        targetDistances.forEach((distance, rIdx) => {
          const isQualified = rIdx === 0 || (teamRoundResults[rIdx]?.qualifiedTeams.includes(teamName));
          if (isQualified) {
            const hits = ath.scores[distance.id] || [];
            const hitCount = getHitCount(hits);
            personalScore += hitCount * distance.multiplier;

            const soloVal = ath.soloHits?.[distance.id];
            const soloHitsNum = (soloVal === null || soloVal === undefined) ? 0 : soloVal;
            personalSolo += soloHitsNum;
          }
        });

        activeTeamScores[teamName] = (activeTeamScores[teamName] || 0) + personalScore + (personalSolo * 0.001);
      });
    }

    const teamRanks: Record<string, number> = {};
    const teamStatsMap: Record<string, { survivalVal: number; score: number }> = {};
    activeAthletes.forEach((ath) => {
      const rawTeam = ath.team.trim();
      const teamName = rawTeam === "" ? "VĐV Tự Do (Không Đội)" : rawTeam;
      if (!teamStatsMap[teamName]) {
        let eliminatedInRoundIdx: number | null = null;
        for (let i = 0; i < teamRoundResults.length; i++) {
          if (teamRoundResults[i].eliminatedTeams.includes(teamName)) {
            eliminatedInRoundIdx = i;
            break;
          }
        }
        const sVal = eliminatedInRoundIdx === null ? targetDistances.length : eliminatedInRoundIdx;
        teamStatsMap[teamName] = {
          survivalVal: sVal,
          score: activeTeamScores[teamName] || 0,
        };
      }
    });

    const teamNames = Object.keys(teamStatsMap);
    teamNames.forEach((tName) => {
      const tStats = teamStatsMap[tName];
      let betterTeamsCount = 0;
      teamNames.forEach((otherName) => {
        if (otherName === tName) return;
        const otherStats = teamStatsMap[otherName];
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

    const teamRanksAllRound: Record<string, number> = {};
    const teamStatsAllRoundMap: Record<string, { score: number }> = {};
    activeAthletes.forEach((ath) => {
      const rawTeam = ath.team.trim();
      const teamName = rawTeam === "" ? "VĐV Tự Do (Không Đội)" : rawTeam;
      if (!teamStatsAllRoundMap[teamName]) {
        let totalScoreAll = 0;
        const members = activeAthletes.filter((a) => {
          const r = a.team.trim();
          const t = r === "" ? "VĐV Tự Do (Không Đội)" : r;
          return t === teamName && a.status !== "Bỏ thi";
        });

        if (hasMaxRoundScoreConf) {
          let teamScoreSum = 0;
          members.forEach((memb) => {
            let memberMaxScore = -1;
            targetDistances.forEach((dist, rIdx) => {
              const isQualified = rIdx === 0 || (teamRoundResults[rIdx]?.qualifiedTeams.includes(teamName));
              if (isQualified) {
                const hits = memb.scores[dist.id] || [];
                const hitCount = getHitCount(hits);
                const score = hitCount * dist.multiplier;
                if (score > memberMaxScore) {
                  memberMaxScore = score;
                }
              }
            });
            teamScoreSum += memberMaxScore >= 0 ? memberMaxScore : 0;
          });
          totalScoreAll = teamScoreSum;
        } else {
          members.forEach((memb) => {
            targetDistances.forEach((d) => {
              const hits = memb.scores[d.id] || [];
              const hitCount = getHitCount(hits);
              totalScoreAll += hitCount * d.multiplier;
            });
          });
        }

        teamStatsAllRoundMap[teamName] = { score: totalScoreAll };
      }
    });

    const teamNamesAllRound = Object.keys(teamStatsAllRoundMap);
    teamNamesAllRound.forEach((tName) => {
      const tStats = teamStatsAllRoundMap[tName];
      let betterTeamsCount = 0;
      teamNamesAllRound.forEach((otherName) => {
        if (otherName === tName) return;
        const otherStats = teamStatsAllRoundMap[otherName];
        if (otherStats.score > tStats.score) {
          betterTeamsCount++;
        }
      });
      teamRanksAllRound[tName] = betterTeamsCount + 1;
    });

    const groups: Record<string, any[]> = {};
    activeAthletesForCalculation.forEach((ath) => {
      const rawTeam = ath.team.trim();
      const teamName = rawTeam === "" ? "VĐV Tự Do (Không Đội)" : rawTeam;

      let totalScore = 0;
      let totalHits = 0;
      let totalShots = 0;
      let accuracyVal = 0;

      if (competitionMode === "team") {
        if (hasMaxRoundScoreConf && activeTab !== "allRound") {
          let maxScore = -1;
          let cumulativeHitsSumInShotRounds = 0;
          let cumulativeMultiplierSumInShotRounds = 0;
          let cumulativeCountInShotRounds = 0;

          targetDistances.forEach((dist, rIdx) => {
            const isQualified = rIdx === 0 || (teamRoundResults[rIdx]?.qualifiedTeams.includes(teamName));
            if (isQualified) {
              const hits = ath.scores[dist.id] || [];
              const hitCount = getHitCount(hits);
              const score = hitCount * dist.multiplier;

              const wasShot = hits.length > 0 && hits.some(v => v !== null && v !== undefined);
              if (wasShot) {
                cumulativeHitsSumInShotRounds += hitCount;
                cumulativeMultiplierSumInShotRounds += dist.multiplier;
                cumulativeCountInShotRounds++;
              }
              if (score > maxScore) {
                maxScore = score;
              }
            }
          });
          totalScore = maxScore >= 0 ? maxScore : 0;
          totalHits = cumulativeHitsSumInShotRounds;
          if (isPointModeActive && effectiveDirectMaxPoints !== undefined) {
            if (cumulativeMultiplierSumInShotRounds === 0 && targetDistances[0]) {
              cumulativeMultiplierSumInShotRounds = targetDistances[0].multiplier;
            }
            totalShots = effectiveDirectMaxPoints * cumulativeMultiplierSumInShotRounds;
          } else {
            if (cumulativeCountInShotRounds === 0) cumulativeCountInShotRounds = 1;
            totalShots = cumulativeCountInShotRounds * effectiveShotsCount;
          }
        } else {
          const survivalInfo = athleteSurvivalMap[ath.id];
          if (survivalInfo) {
            totalScore = survivalInfo.survivalScore;
            totalHits = survivalInfo.survivalHits;
            totalShots = survivalInfo.survivalShots ?? 0;
            accuracyVal = survivalInfo.survivalAccuracy;
          }
        }
      } else {
        if (activeTab === "allRound") {
          if (hasMaxRoundScoreConf) {
            let maxScore = -1;
            let cumulativeHitsSumInShotRounds = 0;
            let cumulativeMultiplierSumInShotRounds = 0;
            let cumulativeCountInShotRounds = 0;

            targetDistances.forEach((dist) => {
              const hits = ath.scores[dist.id] || [];
              const hitCount = getHitCount(hits);
              const score = hitCount * dist.multiplier;

              const wasShot = hits.length > 0 && hits.some(v => v !== null && v !== undefined);
              if (wasShot) {
                cumulativeHitsSumInShotRounds += hitCount;
                cumulativeMultiplierSumInShotRounds += dist.multiplier;
                cumulativeCountInShotRounds++;
              }
              if (score > maxScore) {
                maxScore = score;
              }
            });

            totalScore = maxScore >= 0 ? maxScore : 0;
            totalHits = cumulativeHitsSumInShotRounds;
            if (isPointModeActive && effectiveDirectMaxPoints !== undefined) {
              if (cumulativeMultiplierSumInShotRounds === 0 && targetDistances[0]) {
                cumulativeMultiplierSumInShotRounds = targetDistances[0].multiplier;
              }
              totalShots = effectiveDirectMaxPoints * cumulativeMultiplierSumInShotRounds;
            } else {
              if (cumulativeCountInShotRounds === 0) cumulativeCountInShotRounds = 1;
              totalShots = cumulativeCountInShotRounds * effectiveShotsCount;
            }
          } else {
            targetDistances.forEach((dist) => {
              const hits = ath.scores[dist.id] || [];
              const hitCount = getHitCount(hits);
              totalScore += hitCount * dist.multiplier;
              totalHits += hitCount;
            });
            let totalMultiplierOfShotRounds = 0;
            let countShotRounds = 0;
            targetDistances.forEach((d) => {
              const wasShot = ath.scores[d.id] && ath.scores[d.id].length > 0 && ath.scores[d.id].some(v => v !== null && v !== undefined);
              if (wasShot) {
                totalMultiplierOfShotRounds += d.multiplier;
                countShotRounds++;
              }
            });
            if (countShotRounds === 0 && targetDistances.length > 0) {
              totalMultiplierOfShotRounds = targetDistances[0].multiplier;
              countShotRounds = 1;
            }
            if (isPointModeActive && effectiveDirectMaxPoints !== undefined) {
              totalShots = effectiveDirectMaxPoints * totalMultiplierOfShotRounds;
            } else {
              totalShots = countShotRounds * effectiveShotsCount;
            }
          }
        } else {
          const survivalInfo = athleteSurvivalMap[ath.id];
          if (survivalInfo) {
            totalScore = survivalInfo.survivalScore;
            totalHits = survivalInfo.survivalHits;
            totalShots = survivalInfo.survivalShots ?? 0;
            accuracyVal = survivalInfo.survivalAccuracy;
          }
        }
      }

      const mItem = {
        id: ath.id,
        name: ath.name,
        totalScore,
        totalHits,
        totalShots,
        accuracy: accuracyVal,
      };

      if (!groups[teamName]) {
        groups[teamName] = [];
      }
      groups[teamName].push(mItem);
    });

    const teamsArray = Object.entries(groups).map(([teamName, members]) => {
      let totalScore = members.reduce((sum, m) => sum + m.totalScore, 0);
      let totalHits = members.reduce((sum, m) => sum + m.totalHits, 0);
      let totalShots = members.reduce((sum, m) => sum + m.totalShots, 0);

      if (competitionMode === "team" && hasMaxRoundScoreConf && activeTab !== "allRound") {
        let teamScoreSum = 0;
        const activeMembers = rawAthletes.filter((a) => {
          const raw = a.team.trim();
          const t = raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
          return t === teamName && a.status !== "Bỏ thi" && a.isPrimaryTeam;
        });

        activeMembers.forEach((memb) => {
          let memberMaxScore = -1;
          targetDistances.forEach((dist, rIdx) => {
            const isQualified = rIdx === 0 || (teamRoundResults[rIdx]?.qualifiedTeams.includes(teamName));
            if (isQualified) {
              const hits = memb.scores[dist.id] || [];
              const hitCount = getHitCount(hits);
              const score = hitCount * dist.multiplier;
              if (score > memberMaxScore) {
                memberMaxScore = score;
              }
            }
          });
          teamScoreSum += memberMaxScore >= 0 ? memberMaxScore : 0;
        });
        totalScore = teamScoreSum;
      }

      const averageAccuracy = isPointModeActive && effectiveDirectMaxPoints !== undefined
        ? (totalShots > 0 ? (totalScore / totalShots) * 100 : 0)
        : (totalShots > 0 ? (totalHits / totalShots) * 100 : 0);

      return {
        teamName,
        totalScore,
        totalHits,
        totalShots,
        averageAccuracy,
        memberCount: members.length,
      };
    });

    const sortedTeams = teamsArray.sort((a, b) => {
      if (competitionMode === "team") {
        if (activeTab === "survival") {
          const rankA = teamRanks[a.teamName] || 999;
          const rankB = teamRanks[b.teamName] || 999;
          if (rankA !== rankB) return rankA - rankB;
        } else {
          const rankA = teamRanksAllRound[a.teamName] || 999;
          const rankB = teamRanksAllRound[b.teamName] || 999;
          if (rankA !== rankB) return rankA - rankB;
        }
        return a.teamName.localeCompare(b.teamName, "vi");
      } else {
        if (a.totalScore !== b.totalScore) {
          return b.totalScore - a.totalScore;
        }
        if (b.averageAccuracy !== a.averageAccuracy) {
          return b.averageAccuracy - a.averageAccuracy;
        }
        return a.teamName.localeCompare(b.teamName, "vi");
      }
    });

    return sortedTeams.map((item) => ({
      teamName: item.teamName,
      totalScore: item.totalScore,
      memberCount: item.memberCount,
    }));
  };

  // 6. Aggregate survival stats matching the exact scoring layout
  const teamLeaderboardSurvivalData = useMemo(() => {
    if (tournamentType === "individual") {
      return computeDashboardTeamData(
        athletes,
        distances,
        shotsCount,
        "individual",
        "survival",
        directMaxShots,
        teamDirectMaxShots,
        directMaxPoints,
        teamDirectMaxPoints
      );
    }
    if (tournamentType === "team") {
      const activeTeamAthletes = leaderboardTeamAthletes || teamAthletes || athletes;
      const activeTeamDistancesList = teamDistances || distances;
      const activeTeamShotsCountVal = teamShotsCount || shotsCount;
      return computeDashboardTeamData(
        activeTeamAthletes,
        activeTeamDistancesList,
        activeTeamShotsCountVal,
        "team",
        "survival",
        directMaxShots,
        teamDirectMaxShots,
        directMaxPoints,
        teamDirectMaxPoints
      );
    }

    const groups: Record<string, { totalScore: number; memberCount: number }> = {};
    const hasMaxRoundScoreConf = activeTeamDistances.some(d => d.isMaxRoundScore);

    resolvedTeamAthletes.forEach((athlete) => {
      const rawTeam = athlete.team.trim();
      const teamName = rawTeam === "" ? "VĐV Tự Do (Không Đội)" : rawTeam;

      if (!groups[teamName]) {
        groups[teamName] = { totalScore: 0, memberCount: 0 };
      }
      groups[teamName].memberCount += 1;
    });

    const list = Object.entries(groups).map(([teamName, item]) => {
      let score = 0;
      if (hasMaxRoundScoreConf) {
        score = Math.floor(activeTeamScores[teamName] || 0);
      } else {
        const members = resolvedTeamAthletes.filter((a) => {
          const raw = a.team.trim();
          const t = raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
          return t === teamName && a.status !== "Bỏ thi";
        });
        members.forEach((memb) => {
          let eliminatedInRoundIdx: number | null = null;
          for (let i = 0; i < teamRoundResults.length; i++) {
            if (teamRoundResults[i].eliminatedTeams.includes(teamName)) {
              eliminatedInRoundIdx = i;
              break;
            }
          }
          const lastActiveRoundIdx = eliminatedInRoundIdx === null ? (activeTeamDistances.length - 1) : eliminatedInRoundIdx;
          if (activeTeamDistances.length > 0 && lastActiveRoundIdx >= 0) {
            for (let r = 0; r <= lastActiveRoundIdx; r++) {
              const d = activeTeamDistances[r];
              const hits = memb.scores[d.id] || [];
              const hitCount = getHitCount(hits);
              score += hitCount * d.multiplier;
            }
          }
        });
      }

      return {
        teamName,
        totalScore: score,
        memberCount: item.memberCount,
      };
    });

    return list.sort((a, b) => {
      const rankA = teamRanks[a.teamName] || 999;
      const rankB = teamRanks[b.teamName] || 999;
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return a.teamName.localeCompare(b.teamName, "vi");
    });
  }, [
    athletes,
    distances,
    shotsCount,
    leaderboardTeamAthletes,
    teamAthletes,
    teamDistances,
    teamShotsCount,
    tournamentType,
    directMaxShots,
    teamDirectMaxShots,
    directMaxPoints,
    teamDirectMaxPoints,
    resolvedTeamAthletes,
    activeTeamDistances,
    teamRoundResults,
    teamRanks,
    activeTeamScores
  ]);

  // 7. Aggregate cumulative stats matching the exact scoring layout
  const teamLeaderboardAllRoundData = useMemo(() => {
    if (tournamentType === "individual") {
      return computeDashboardTeamData(
        athletes,
        distances,
        shotsCount,
        "individual",
        "allRound",
        directMaxShots,
        teamDirectMaxShots,
        directMaxPoints,
        teamDirectMaxPoints
      );
    }
    if (tournamentType === "team") {
      const activeTeamAthletes = leaderboardTeamAthletes || teamAthletes || athletes;
      const activeTeamDistancesList = teamDistances || distances;
      const activeTeamShotsCountVal = teamShotsCount || shotsCount;
      return computeDashboardTeamData(
        activeTeamAthletes,
        activeTeamDistancesList,
        activeTeamShotsCountVal,
        "team",
        "allRound",
        directMaxShots,
        teamDirectMaxShots,
        directMaxPoints,
        teamDirectMaxPoints
      );
    }

    const groups: Record<string, { totalScore: number; memberCount: number }> = {};
    const hasMaxRoundScoreConf = activeTeamDistances.some(d => d.isMaxRoundScore);

    resolvedTeamAthletes.forEach((athlete) => {
      const rawTeam = athlete.team.trim();
      const teamName = rawTeam === "" ? "VĐV Tự Do (Không Đội)" : rawTeam;

      if (!groups[teamName]) {
        groups[teamName] = { totalScore: 0, memberCount: 0 };
      }
      groups[teamName].memberCount += 1;
    });

    const list = Object.entries(groups).map(([teamName, item]) => {
      let score = 0;
      if (hasMaxRoundScoreConf) {
        const members = resolvedTeamAthletes.filter((a) => {
          const raw = a.team.trim();
          const t = raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
          return t === teamName && a.isPrimaryTeam && a.status !== "Bỏ thi";
        });

        let teamScoreSum = 0;
        members.forEach((memb) => {
          let memberMaxScore = -1;
          activeTeamDistances.forEach((dist, rIdx) => {
            const isQualified = rIdx === 0 || (teamRoundResults[rIdx]?.qualifiedTeams.includes(teamName));
            if (isQualified) {
              const hits = memb.scores[dist.id] || [];
              const hitCount = getHitCount(hits);
              const scoreVal = hitCount * dist.multiplier;
              if (scoreVal > memberMaxScore) {
                memberMaxScore = scoreVal;
              }
            }
          });
          teamScoreSum += memberMaxScore >= 0 ? memberMaxScore : 0;
        });
        score = teamScoreSum;
      } else {
        const members = resolvedTeamAthletes.filter((a) => {
          const raw = a.team.trim();
          const t = raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
          return t === teamName;
        });
        members.forEach((memb) => {
          activeTeamDistances.forEach((d) => {
            const hits = memb.scores[d.id] || [];
            const hitCount = getHitCount(hits);
            score += hitCount * d.multiplier;
          });
        });
      }

      return {
        teamName,
        totalScore: score,
        memberCount: item.memberCount,
      };
    });

    return list.sort((a, b) => {
      const rankA = teamRanksAllRound[a.teamName] || 999;
      const rankB = teamRanksAllRound[b.teamName] || 999;
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return a.teamName.localeCompare(b.teamName, "vi");
    });
  }, [
    athletes,
    distances,
    shotsCount,
    leaderboardTeamAthletes,
    teamAthletes,
    teamDistances,
    teamShotsCount,
    tournamentType,
    directMaxShots,
    teamDirectMaxShots,
    directMaxPoints,
    teamDirectMaxPoints,
    resolvedTeamAthletes,
    activeTeamDistances,
    teamRanksAllRound,
    teamRoundResults
  ]);

  const top3SurvivalTeams = useMemo(() => {
    const list = [...teamLeaderboardSurvivalData];
    while (list.length < 3) {
      list.push({
        teamName: "Chưa Có Đội",
        totalScore: 0,
        memberCount: 0,
      });
    }
    return list.slice(0, 3);
  }, [teamLeaderboardSurvivalData]);

  const top3AllRoundTeams = useMemo(() => {
    const list = [...teamLeaderboardAllRoundData];
    while (list.length < 3) {
      list.push({
        teamName: "Chưa Có Đội",
        totalScore: 0,
        memberCount: 0,
      });
    }
    return list.slice(0, 3);
  }, [teamLeaderboardAllRoundData]);

  // Dynamically resolve target data based on actual select
  const currentTop3Athletes = dashboardTab === "survival" ? top3SurvivalAthletes : top3AllRoundAthletes;
  const currentTop3Teams = dashboardTab === "survival" ? top3SurvivalTeams : top3AllRoundTeams;

  const currentRankedList = dashboardTab === "survival" ? rankedSurvivalAthletes : rankedAllRoundAthletes;

  const slicedTopAthletes = useMemo(() => {
    const rawList = currentRankedList.slice(0, topXCount);
    return rawList.map(ath => ({
      ...ath,
      displayScore: dashboardTab === "survival" ? ath.survivalScore : ath.totalScore,
      displayAccuracy: dashboardTab === "survival" ? ath.survivalAccuracy : ath.accuracy,
    }));
  }, [currentRankedList, topXCount, dashboardTab]);

  const pagedAthletes = useMemo(() => {
    if (topXCount <= 25) {
      return slicedTopAthletes;
    }
    const startIdx = (currentPage - 1) * 25;
    return slicedTopAthletes.slice(startIdx, startIdx + 25);
  }, [slicedTopAthletes, currentPage, topXCount]);

  const totalPages = useMemo(() => {
    if (topXCount <= 25) {
      return 1;
    }
    return Math.ceil(slicedTopAthletes.length / 25);
  }, [slicedTopAthletes.length, topXCount]);

  // General Highlights
  const dashboardHighlights = useMemo(() => {
    const totals = processedAthletes.reduce(
      (acc, curr) => {
        acc.score += curr.totalScore;
        acc.hits += curr.totalHits;
        acc.shots += curr.totalPossibleShots;
        return acc;
      },
      { score: 0, hits: 0, shots: 0 }
    );

    const winner = processedAthletes.length > 0 
      ? [...processedAthletes].sort((a, b) => b.totalScore - a.totalScore)[0]
      : null;

    const avgAccuracy = totals.shots > 0 ? (totals.hits / totals.shots) * 100 : 0;

    return {
      totalMatchScore: totals.score,
      totalHits: totals.hits,
      avgAccuracy,
      highestScorer: winner && winner.totalScore > 0 ? winner : null,
      activeClubsCount: teamStats.filter((t) => t.teamName !== "VĐV Tự Do" && t.totalScore > 0).length,
    };
  }, [processedAthletes, teamStats]);

  // Calculate unique clubs count registered in Danh sách VĐV
  const registeredClubsCount = useMemo(() => {
    const list = masterAthletes || [];
    if (list.length === 0) {
      return teamStats.filter((t) => t.teamName !== "VĐV Tự Do" && t.teamName !== "VĐV Tự Do (Không Đội)").length;
    }
    const uniqueClubs = new Set<string>();
    list.forEach((m) => {
      const rawTeam = (m.team || "").trim();
      if (
        rawTeam !== "" && 
        rawTeam.toLowerCase() !== "tự do" && 
        rawTeam.toLowerCase() !== "vdv tự do" && 
        rawTeam.toLowerCase() !== "vđv tự do (không đội)"
      ) {
        uniqueClubs.add(rawTeam);
      }
    });
    return uniqueClubs.size;
  }, [masterAthletes, teamStats]);

  const getTeamAvatar = (teamName: string, place: 1 | 2 | 3) => {
    const club = clubs?.find(c => c.name.trim().toLowerCase() === teamName.trim().toLowerCase());
    const badgeColor = place === 1 ? "text-amber-500 fill-amber-100" : place === 2 ? "text-slate-300 fill-slate-100" : "text-amber-700/80 fill-orange-50";
    const borderColor = place === 1 ? "border-amber-400 ring-4 ring-amber-500/10" : place === 2 ? "border-slate-300 ring-2 ring-slate-400/5" : "border-amber-700/30 ring-2 ring-amber-800/5";
    const size = place === 1 ? "w-14 h-14" : "w-11 h-11";
    const badgeSize = place === 1 ? "w-5 h-5" : "w-4 h-4";
    const Icon = place === 1 ? Trophy : place === 2 ? Medal : Award;

    if (club && club.avatarUrl) {
      return (
        <div className="relative flex justify-center items-center mb-1">
          <img 
            src={club.avatarUrl} 
            alt={teamName} 
            className={`${size} rounded-full object-cover border-2 ${borderColor} shadow-md`}
            referrerPolicy="no-referrer"
          />
          <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-950 rounded-full p-0.5 shadow-xs border border-slate-100 dark:border-slate-800">
            <Icon className={`${badgeSize} ${badgeColor}`} />
          </div>
        </div>
      );
    }

    // Fallback if no avatar
    return (
      <div className="flex justify-center items-center mb-1">
        <Icon className={`${place === 1 ? "w-10 h-10" : place === 2 ? "w-7 h-7" : "w-6 h-6"} ${badgeColor} drop-shadow-md animate-bounce`} />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn" id="vsc-main-dashboard">
      
      {/* Dynamic Champion Header Card with Dual Vector Branding */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden border border-indigo-800 shadow-xl">
        {/* Abstract decorative SVG ring background */}
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none translate-x-12 -translate-y-12">
          <svg width="400" height="400" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="40" stroke="white" strokeWidth="1" />
            <circle cx="50" cy="50" r="30" stroke="white" strokeWidth="2" strokeDasharray="4 4" />
          </svg>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
          <div className="flex items-center gap-4.5">
            <VSCLogo size={80} className="shrink-0" />
            
            <div className="text-center md:text-left">
              <span className="text-[11px] font-extrabold tracking-widest text-[#f59e0b] uppercase bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                {language === "en" ? "PROFESSIONAL NATIONAL TOURNAMENT" : "GIẢI ĐẤU QUỐC GIA CHUYÊN NGHIỆP"}
              </span>
              <h1 className="text-2xl sm:text-3.5xl font-black font-sans leading-none text-white tracking-tight mt-2 uppercase">
                Vietnam Slingshot Championship
              </h1>
              <div className="mt-2.5 bg-white/5 border border-white/10 rounded-2xl p-3 max-w-xl shadow-sm">
                <span className="text-[10px] text-amber-400 font-extrabold tracking-widest block uppercase font-mono mb-0.5">{language === "en" ? "ACTIVE TOURNAMENT:" : "GIẢI ĐẤU ĐANG DIỄN RA:"}</span>
                <span className="text-sm sm:text-base font-black text-white block leading-tight">{matchName}</span>
              </div>
              <p className="text-gray-300 text-xs sm:text-sm font-medium mt-2 max-w-xl">
                {language === "en" 
                  ? "Leaderboard honoring the best slingshot masters and clubs in the tournament. Real-time updates and automated rankings."
                  : "Bảng vàng Vinh Danh Tổng Hợp các danh thủ và câu lạc bộ bắn ná xuất sắc nhất giải đấu. Cập nhật thành tích thời gian thực và xếp hạng tự động."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 p-3 rounded-2xl backdrop-blur-md">
            <SlingshotIcon size={64} className="shrink-0" />
            <div className="text-left shrink-0">
              <span className="text-[9px] uppercase font-mono font-bold text-gray-400 block tracking-wider">{language === "en" ? "Standard System" : "Hệ Thống Tiêu Chuẩn"}</span>
              <span className="text-sm font-black text-amber-300 block">{language === "en" ? "VIETNAM SLINGSHOT" : "NÁ CAO SU VIỆT NAM"}</span>
              <span className="text-xs text-white/80 block mt-0.5">&bull; {distances.length} {language === "en" ? "specialized shooting distances" : "cự ly bắn chuyên dụng"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Overview Stats highlight bars */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Item 1 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="bg-amber-100 dark:bg-amber-950/40 p-2.5 rounded-xl">
            <Trophy className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 block font-sans">{language === "en" ? "Score Record" : "Kỷ Lục Điểm"}</span>
            <span className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 block">
              {dashboardHighlights.highestScorer ? `${dashboardHighlights.highestScorer.totalScore}${language === "en" ? "pts" : "đ"}` : `0${language === "en" ? "pts" : "đ"}`}
            </span>
            <span className="text-[10px] text-slate-500 truncate block max-w-[120px]">
              {dashboardHighlights.highestScorer ? dashboardHighlights.highestScorer.name : (language === "en" ? "Not set" : "Chưa lập")}
            </span>
          </div>
        </div>

        {/* Item 2 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="bg-indigo-100 dark:bg-indigo-950/40 p-2.5 rounded-xl">
            <Shield className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 block font-sans">{language === "en" ? "Club Base" : "Cơ Sở CLB"}</span>
            <span className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 block">
              {registeredClubsCount} {language === "en" ? "Clubs" : "CLB"}
            </span>
            <span className="text-[10px] text-slate-500 block">{language === "en" ? "Participating" : "Tham gia giải đấu"}</span>
          </div>
        </div>

        {/* Item 3 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="bg-emerald-100 dark:bg-emerald-950/40 p-2.5 rounded-xl">
            <Target className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 block font-sans">{language === "en" ? "Accuracy" : "Độ Chính Xác"}</span>
            <span className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 block">
              {dashboardHighlights.avgAccuracy.toFixed(1)}% Acc
            </span>
            <span className="text-[10px] text-slate-500 block">{language === "en" ? "Entire tournament" : "Toàn giải thi đấu"}</span>
          </div>
        </div>

        {/* Item 4 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="bg-rose-100 dark:bg-rose-955/30 p-2.5 rounded-xl">
            <Users className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 block font-sans">{language === "en" ? "Athlete Count" : "Sĩ Số Đấu Thủ"}</span>
            <span className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 block">
              {masterAthletes && masterAthletes.length > 0 ? masterAthletes.length : athletes.length} {language === "en" ? "Athletes" : "VĐV"}
            </span>
            <span className="text-[10px] text-slate-500 block">{language === "en" ? "Registered to compete" : "Đã đăng ký thi đấu"}</span>
          </div>
        </div>
      </div>

      {/* Tab Selector Area */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-100/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-2xl">
        <span className="text-xs font-black text-slate-700 dark:text-slate-350 uppercase tracking-wider px-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500 fill-amber-100" />
          {language === "en" ? "Honor Leaderboard Zone:" : "Khu Vực Bảng Vàng Danh Dự:"}
        </span>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onOpenExportModal && (
            <button
              type="button"
              onClick={onOpenExportModal}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-black uppercase rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2 tracking-wider"
              id="btn-export-share-dashboard"
            >
              <Share2 className="w-4 h-4" />
              {language === "en" ? "SHARE IMAGE" : "CHIA SẺ ẢNH"}
            </button>
          )}
          {onOpenLiveBoard && (
            <button
              type="button"
              onClick={onOpenLiveBoard}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-755 hover:to-teal-805 text-white text-xs sm:text-sm font-black uppercase rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2 tracking-wider"
              id="btn-liveboard-dashboard"
            >
              <Tv className="w-4 h-4" />
              LIVE BOARD
            </button>
          )}
          <button
            type="button"
            onClick={() => setDashboardTab("survival")}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2 border shadow-xs ${
              dashboardTab === "survival"
                ? "bg-gradient-to-r from-blue-600 to-indigo-700 text-white border-indigo-700 shadow-md transform scale-102"
                : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-850 hover:bg-slate-50"
            }`}
          >
            <Shield className="w-4 h-4" />
            {language === "en" ? "Survival" : "Trụ Lại Cuối Cùng"}
          </button>
          <button
            type="button"
            onClick={() => setDashboardTab("allRound")}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2 border shadow-xs ${
              dashboardTab === "allRound"
                ? "bg-gradient-to-r from-amber-500 to-amber-655 text-white border-amber-600 shadow-md transform scale-102"
                : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-850 hover:bg-slate-50"
            }`}
          >
            <Trophy className="w-4 h-4" />
            {language === "en" ? "All-Round (Cumulative)" : "Toàn Giải (Cộng dồn)"}
          </button>
        </div>
      </div>

      {/* Podiums Side-by-side Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
        
        {/* Left Card: Bảng Vàng Cá Nhân (Top 3 Individuals Podium) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500 fill-amber-100 animate-pulse" />
              {tournamentType === "individual" ? (
                dashboardTab === "survival" 
                  ? (language === "en" ? "Individual Leaderboard - Survival (Individual Mode)" : "Bảng Vàng Cá Nhân - Trụ Lại Cuối Cùng (môi trường Cá Nhân)") 
                  : (language === "en" ? "Individual Leaderboard - All-Round (Individual Mode)" : "Bảng Vàng Cá Nhân - Toàn Giải (môi trường Cá Nhân)")
              ) : tournamentType === "team" ? (
                dashboardTab === "survival" 
                  ? (language === "en" ? "Team Athletes Leaderboard - Survival (Team Mode)" : "Bảng Vàng Cá Nhân Team - Trụ Lại Cuối Cùng (môi trường Đồng Đội)") 
                  : (language === "en" ? "Team Athletes Leaderboard - All-Round (Team Mode)" : "Bảng Vàng Cá Nhân Team - Toàn Giải (môi trường Đồng Đội)")
              ) : (
                dashboardTab === "survival" 
                  ? (language === "en" ? "Individual Leaderboard - Survival" : "Bảng Vàng Cá Nhân - Trụ Lại Cuối Cùng") 
                  : (language === "en" ? "Individual Leaderboard - All-Round" : "Bảng Vàng Cá Nhân - Toàn Giải")
              )}
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {tournamentType === "individual" ? (
                dashboardTab === "survival"
                  ? (language === "en" ? "Top 3 athletes remaining longest through the individual elimination rounds." : "Top 3 VĐV còn trụ lại lâu nhất qua các vòng thi đấu loại cá nhân.")
                  : (language === "en" ? "Top 3 slingshot masters with the highest total combined score in individual tournament." : "Top 3 danh thủ sở hữu tổng điểm gộp cao nhất của giải cá nhân.")
              ) : tournamentType === "team" ? (
                dashboardTab === "survival"
                  ? (language === "en" ? "Top 3 athletes remaining longest through the team elimination rounds." : "Top 3 VĐV còn trụ lại lâu nhất qua các vòng thi đấu loại đồng đội.")
                  : (language === "en" ? "Top 3 slingshot masters with the highest total combined score in team tournament." : "Top 3 danh thủ sở hữu tổng điểm gộp cao nhất của giải đồng đội.")
              ) : (
                dashboardTab === "survival"
                  ? (language === "en" ? "Top 3 athletes remaining longest through the tournament elimination rounds." : "Top 3 VĐV còn trụ lại lâu nhất qua các vòng thi đấu loại của giải.")
                  : (language === "en" ? "Top 3 slingshot masters with the highest total combined score in the entire tournament." : "Top 3 danh thủ sở hữu tổng điểm gộp cao nhất của cả giải đấu.")
              )}
            </p>
          </div>

          {/* 3D Athlete Podium UI representation */}
          <div className="mt-8 flex items-end justify-center select-none pt-6 bg-gradient-to-b from-transparent to-slate-50/50 dark:to-slate-950/10 rounded-2xl pb-2 px-2 border border-dashed border-gray-100/50 min-h-[280px]">
            {/* 2nd PLACE INDIVIDUAL - SILVER PODIUM (LEFT) */}
            <div className="flex flex-col items-center flex-1 max-w-[130px] z-10">
              {/* Profile & Avatar */}
              <div className="text-center mb-1.5 px-1 flex flex-col items-center w-full">
                <div className="relative">
                  <img
                    src={currentTop3Athletes[1].avatarUrl || AVATAR_MALE}
                    alt={currentTop3Athletes[1].name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-slate-300 shadow-sm bg-slate-100"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute -top-1.5 -right-1.5 bg-slate-200 text-slate-800 rounded-full w-5 h-5 flex items-center justify-center border border-white text-[10px] font-black font-sans shadow-sm">
                    2
                  </div>
                </div>
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 block truncate leading-tight mt-1.5 w-full text-center" title={currentTop3Athletes[1].name}>
                  {currentTop3Athletes[1].name}
                </span>
                <span className="text-[10px] text-gray-400 block truncate leading-none mt-0.5 max-w-[100px] text-center" title={currentTop3Athletes[1].team}>
                  {currentTop3Athletes[1].team || (language === "en" ? "Independent" : "Tự Do")}
                </span>
                <span className="font-mono text-xs font-black text-blue-600 dark:text-blue-400 block mt-1">
                  {currentTop3Athletes[1].displayScore} {language === "en" ? "pts" : "đ"}
                </span>
              </div>
              {/* Podium Column Box */}
              <div className="w-full bg-gradient-to-t from-slate-250 via-slate-150 to-slate-100/90 dark:from-slate-800 dark:to-slate-700/80 border-t-2 border-slate-300 h-24 rounded-t-xl shadow-lg flex items-center justify-center relative">
                <span className="font-black text-5xl font-mono text-slate-400/30">2</span>
                <span className="absolute bottom-2 text-[10px] font-black uppercase text-slate-500">{language === "en" ? "2nd Place" : "Hạng Nhì"}</span>
              </div>
            </div>

            {/* 1st PLACE INDIVIDUAL - GOLD PODIUM (CENTER, TALLEST) */}
            <div className="flex flex-col items-center flex-1 max-w-[155px] z-20 -mx-1">
              {/* Profile & Avatar */}
              <div className="text-center mb-3 px-1 flex flex-col items-center w-full">
                <div className="relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-amber-500 drop-shadow-sm scale-110">👑</div>
                  <img
                    src={currentTop3Athletes[0].avatarUrl || AVATAR_MALE}
                    alt={currentTop3Athletes[0].name}
                    className="w-16 h-16 rounded-full object-cover border-4 border-amber-400 shadow-md bg-slate-100"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute -top-1.5 -right-1.5 bg-amber-400 text-amber-950 rounded-full w-6 h-6 flex items-center justify-center border border-white text-xs font-black font-sans shadow-md">
                    1
                  </div>
                </div>
                <span className="text-sm font-black text-slate-900 dark:text-slate-101 block truncate leading-tight tracking-tight mt-2 w-full text-center" title={currentTop3Athletes[0].name}>
                  {currentTop3Athletes[0].name}
                </span>
                <span className="text-[10px] text-gray-400 block truncate leading-none mt-0.5 max-w-[120px] text-center" title={currentTop3Athletes[0].team}>
                  {currentTop3Athletes[0].team || (language === "en" ? "Independent" : "Tự Do")}
                </span>
                <span className="font-mono text-sm font-extrabold text-amber-600 block leading-tight mt-1">
                  {currentTop3Athletes[0].displayScore} {language === "en" ? "pts" : "đ"}
                </span>
              </div>
              {/* Podium Column Box */}
              <div className="w-full bg-gradient-to-t from-amber-400/90 via-amber-300/85 to-amber-200/90 border-t-4 border-amber-400 h-36 rounded-t-2xl shadow-xl flex items-center justify-center relative ring-4 ring-amber-500/10">
                <span className="font-black text-6xl font-mono text-amber-600/40">1</span>
                <span className="absolute bottom-2 text-[10px] sm:text-xs font-black uppercase text-amber-700 flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-500 stroke-amber-500" /> {language === "en" ? "Champion" : "Quán Quân"} <Star className="w-3 h-3 fill-amber-500 stroke-amber-500" />
                </span>
              </div>
            </div>

            {/* 3rd PLACE INDIVIDUAL - BRONZE PODIUM (RIGHT, SHORTEST) */}
            <div className="flex flex-col items-center flex-1 max-w-[130px] z-10">
              {/* Profile & Avatar */}
              <div className="text-center mb-1 px-1 flex flex-col items-center w-full">
                <div className="relative">
                  <img
                    src={currentTop3Athletes[2].avatarUrl || AVATAR_MALE}
                    alt={currentTop3Athletes[2].name}
                    className="w-11 h-11 rounded-full object-cover border-2 border-amber-700/50 shadow-sm bg-slate-100"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute -top-1.5 -right-1.5 bg-amber-700 text-white rounded-full w-5 h-5 flex items-center justify-center border border-white text-[10px] font-black font-sans shadow-sm">
                    3
                  </div>
                </div>
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 block truncate leading-tight mt-1.5 w-full text-center" title={currentTop3Athletes[2].name}>
                  {currentTop3Athletes[2].name}
                </span>
                <span className="text-[10px] text-gray-400 block truncate leading-none mt-0.5 max-w-[100px] text-center" title={currentTop3Athletes[2].team}>
                  {currentTop3Athletes[2].team || (language === "en" ? "Independent" : "Tự Do")}
                </span>
                <span className="font-mono text-xs font-black text-blue-600 dark:text-blue-400 block mt-1">
                  {currentTop3Athletes[2].displayScore} {language === "en" ? "pts" : "đ"}
                </span>
              </div>
              {/* Podium Column Box */}
              <div className="w-full bg-gradient-to-t from-amber-800/15 via-amber-700/10 to-amber-600/10 dark:from-slate-850 dark:to-slate-800/80 border-t-2 border-amber-700/30 h-16 rounded-t-xl shadow-lg flex items-center justify-center relative">
                <span className="font-black text-4xl font-mono text-amber-700/20">3</span>
                <span className="absolute bottom-2 text-[10px] font-black uppercase text-amber-800/60 font-sans">{language === "en" ? "3rd Place" : "Hạng Ba"}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center">
            <span className="text-[10px] text-gray-400 italic block">
              {dashboardTab === "survival"
                ? (language === "en" ? "Individual title honoring athletes who persistently accompany through the next rounds." : "Danh hiệu cá nhân vinh danh các tuyển thủ kiên trì đồng hành qua các vòng đấu tiếp theo.")
                : (language === "en" ? "Individual title honoring the athlete with the highest performance score throughout the rounds." : "Danh hiệu cá nhân tôn vinh tuyển thủ có tổng điểm thành tích cao nhất xuyên suốt các vòng đấu.")}
            </span>
          </div>
        </div>

        {/* Right Card: Bảng Vàng Đồng Đội (Top 3 Teams Podium) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              {tournamentType === "individual" ? (
                dashboardTab === "survival" 
                  ? (language === "en" ? "Team Leaderboard - Survival (Individual Mode)" : "Bảng Vàng Đồng Đội - Trụ Lại Cuối Cùng (môi trường Cá Nhân)") 
                  : (language === "en" ? "Team Leaderboard - All-Round (Individual Mode)" : "Bảng Vàng Đồng Đội - Toàn Giải (môi trường Cá Nhân)")
              ) : tournamentType === "team" ? (
                dashboardTab === "survival" 
                  ? (language === "en" ? "Team Leaderboard - Survival (Team Mode)" : "Bảng Vàng Đồng Đội - Trụ Lại Cuối Cùng (môi trường Đồng Đội)") 
                  : (language === "en" ? "Team Leaderboard - All-Round (Team Mode)" : "Bảng Vàng Đồng Đội - Toàn Giải (môi trường Đồng Đội)")
              ) : (
                dashboardTab === "survival" 
                  ? (language === "en" ? "Team Leaderboard - Survival" : "Bảng Vàng Đồng Đội - Trụ Lại Cuối Cùng") 
                  : (language === "en" ? "Team Leaderboard - All-Round" : "Bảng Vàng Đồng Đội - Toàn Giải")
              )}
            </h2>
            <p className="text-xs text-gray-400 mt-1 font-sans">
              {tournamentType === "individual" ? (
                dashboardTab === "survival"
                  ? (language === "en" ? "Top 3 Collective representatives based on individual Survival performance." : "Top 3 đại diện Tập Thể dựa trên thành tích Trụ Lại Cuối Cùng cá nhân.")
                  : (language === "en" ? "Top 3 Collectives with the highest combined score from members in individual tournament." : "Top 3 Tập Thể có tổng điểm gộp cao nhất từ các thành viên trong giải cá nhân.")
              ) : tournamentType === "team" ? (
                dashboardTab === "survival"
                  ? (language === "en" ? "Top 3 Collective representatives based on team Survival performance." : "Top 3 đại diện Tập Thể dựa trên thành tích Trụ Lại Cuối Cùng đồng đội.")
                  : (language === "en" ? "Top 3 Collectives with the highest combined score from members in team tournament." : "Top 3 Tập Thể có tổng điểm gộp cao nhất từ các thành viên trong giải đồng đội.")
              ) : (
                dashboardTab === "survival"
                  ? (language === "en" ? "Top 3 Collective representatives based on the Survival performance of the Main Roster." : "Top 3 đại diện Tập Thể dựa trên thành tích Trụ Lại Cuối Cùng của đội hình Bắn chính.")
                  : (language === "en" ? "Top 3 Collectives with the highest accumulated member score overall." : "Top 3 Tập Thể sở hữu tổng điểm tích lũy thành viên cao nhất toàn giải.")
              )}
            </p>
          </div>

          {/* 3D Physical Podium UI representation */}
          <div className="mt-8 flex items-end justify-center select-none pt-4 bg-gradient-to-b from-transparent to-slate-50/50 dark:to-slate-950/10 rounded-2xl pb-2 px-2 border border-dashed border-gray-100/50 min-h-[280px]">
            {/* 2nd PLACE TEAM - SILVER PODIUM (LEFT) */}
            <div className="flex flex-col items-center flex-1 max-w-[130px] z-10">
              {/* Cup & Team details */}
              <div className="text-center mb-1.5 px-1 w-full flex flex-col items-center">
                {getTeamAvatar(currentTop3Teams[1].teamName, 2)}
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 block truncate leading-tight mt-1.5 w-full text-center" title={currentTop3Teams[1].teamName}>
                  {currentTop3Teams[1].teamName}
                </span>
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 block leading-tight mt-1">
                  {currentTop3Teams[1].totalScore} {language === "en" ? "pts" : "đ"}
                </span>
              </div>
              {/* Podium Column Box */}
              <div className="w-full bg-gradient-to-t from-slate-200 via-slate-150 to-slate-100/90 dark:from-slate-800 dark:to-slate-700/80 border-t-2 border-slate-300 h-24 rounded-t-xl shadow-lg flex items-center justify-center relative">
                <span className="font-black text-5xl font-mono text-slate-400/30">2</span>
                <span className="absolute bottom-2 text-[10px] font-black uppercase text-slate-500">{language === "en" ? "2nd Place" : "Hạng Nhì"}</span>
              </div>
            </div>

            {/* 1st PLACE TEAM - GOLD PODIUM (CENTER, TALLEST) */}
            <div className="flex flex-col items-center flex-1 max-w-[150px] z-20 -mx-1">
              {/* Cup & Team details */}
              <div className="text-center mb-3 px-1 w-full flex flex-col items-center">
                {getTeamAvatar(currentTop3Teams[0].teamName, 1)}
                <span className="text-sm font-black text-slate-900 dark:text-slate-101 block truncate leading-tight tracking-tight mt-1.5 w-full text-center" title={currentTop3Teams[0].teamName}>
                  {currentTop3Teams[0].teamName}
                </span>
                <span className="font-mono text-sm font-extrabold text-amber-600 block leading-tight mt-1">
                  {currentTop3Teams[0].totalScore} {language === "en" ? "pts" : "đ"}
                </span>
              </div>
              {/* Podium Column Box */}
              <div className="w-full bg-gradient-to-t from-amber-400/90 via-amber-300/85 to-amber-200/90 border-t-4 border-amber-400 h-36 rounded-t-2.5xl shadow-xl flex items-center justify-center relative ring-4 ring-amber-500/10">
                <span className="font-black text-6xl font-mono text-amber-600/40">1</span>
                <span className="absolute bottom-2 text-xs font-black uppercase text-amber-700 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-500 stroke-amber-500" /> {language === "en" ? "Champion" : "Quán Quân"} <Star className="w-3.5 h-3.5 fill-amber-500 stroke-amber-500" />
                </span>
              </div>
            </div>

            {/* 3rd PLACE TEAM - BRONZE PODIUM (RIGHT, SHORTEST) */}
            <div className="flex flex-col items-center flex-1 max-w-[130px] z-10">
              {/* Cup & Team details */}
              <div className="text-center mb-1 px-1 w-full flex flex-col items-center">
                {getTeamAvatar(currentTop3Teams[2].teamName, 3)}
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 block truncate leading-tight mt-1.5 w-full text-center" title={currentTop3Teams[2].teamName}>
                  {currentTop3Teams[2].teamName}
                </span>
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 block leading-tight mt-1">
                  {currentTop3Teams[2].totalScore} {language === "en" ? "pts" : "đ"}
                </span>
              </div>
              {/* Podium Column Box */}
              <div className="w-full bg-gradient-to-t from-amber-800/15 via-amber-700/10 to-amber-600/10 dark:from-slate-850 dark:to-slate-800/80 border-t-2 border-amber-700/30 h-16 rounded-t-xl shadow-lg flex items-center justify-center relative">
                <span className="font-black text-4xl font-mono text-amber-700/20">3</span>
                <span className="absolute bottom-2 text-[10px] font-black uppercase text-amber-800/60 font-sans">{language === "en" ? "3rd Place" : "Hạng Ba"}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center">
            <span className="text-[10px] text-gray-400 italic block">
              {tournamentType === "individual"
                ? (language === "en" ? "Accumulated score from all individual athletes belonging to each roster/club." : "Thành tích cộng tích luỹ điểm từ tất cả vận động viên cá nhân thuộc mỗi đội hình/câu lạc bộ.")
                : (language === "en" ? "Scores only accumulated from players checked as official roster belonging to each Survival team." : "Thành tích chỉ cộng tích luỹ điểm từ các đấu thủ được tick bắn chính thức thuộc mỗi đội hình Trụ Lại Cuối Cùng.")}
            </span>
          </div>
        </div>

      </div>

      {/* Roster Container: DANH SÁCH TOP X */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col mt-6">
          
        {/* Header controls select TOP X */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-3 border-b border-gray-100 dark:border-slate-800 gap-4 mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Star className="w-5 h-5 text-amber-500 fill-amber-100" />
              {language === "en" 
                ? `TOP ${topXCount} List - ${dashboardTab === "survival" ? "Survival" : "All-Round"}` 
                : `Danh Sách TOP ${topXCount} - ${dashboardTab === "survival" ? "Trụ Lại Cuối Cùng" : "Toàn Giải"}`}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {dashboardTab === "survival" 
                ? (language === "en" ? "Rankings based on the highest resilience and survival performance through elimination rounds." : "Xếp hạng dựa trên thành tích kiên cường trụ lại và tồn tại cao nhất qua các vòng loại.") 
                : (language === "en" ? "Rankings based on accumulated total score from the beginning of the tournament to present." : "Xếp hạng dựa trên tổng điểm luỹ kế tích luỹ từ đầu giải đấu đến hiện tại.")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
              {[3, 5, 10].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setTopXCount(num)}
                  className={`px-3 py-1 text-xs font-black rounded-md transition-all cursor-pointer ${
                    topXCount === num
                      ? "bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-sm"
                      : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  TOP {num}
                </button>
              ))}
            </div>
            
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg">
              <span className="text-[10px] font-bold text-gray-400 uppercase">{language === "en" ? "Custom:" : "Tự nhập:"}</span>
              <input
                type="number"
                min="1"
                max="500"
                value={topXCount === 0 ? "" : topXCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val >= 0) {
                    setTopXCount(val);
                  } else if (e.target.value === "") {
                    setTopXCount(0);
                  }
                }}
                onBlur={() => {
                  if (topXCount <= 0) {
                    setTopXCount(10);
                  }
                }}
                className="w-12 text-center text-xs font-black bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded p-0.5 text-blue-600 dark:text-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Roster list */}
        <div className="flex-1 mt-4 flex flex-col gap-2.5">
            {pagedAthletes.length === 0 ? (
              <div className="text-center py-12 text-gray-400 border border-dashed border-gray-150 rounded-2xl">
                {language === "en" ? "No shooters found competing for the prize." : "Không tìm thấy xạ thủ nào đang tranh giải."}
              </div>
            ) : (
              pagedAthletes.map((athlete, index) => {
                const rank = athlete.status === "Bỏ thi" ? "-" : (athlete as any).dashboardRank || ((currentPage - 1) * 25 + index + 1);
                const hasScore = athlete.displayScore > 0;
                
                return (
                  <div 
                    key={athlete.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 dark:border-slate-800 bg-white hover:bg-slate-50/50 transition-colors shadow-sm gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Rank indicators */}
                      <span className={`w-6 h-6 text-xs font-black font-sans rounded-full flex items-center justify-center shrink-0 ${
                        rank === 1 && hasScore
                          ? "bg-amber-500 text-white"
                          : rank === 2 && hasScore
                            ? "bg-slate-300 text-slate-800"
                            : rank === 3 && hasScore
                              ? "bg-amber-700 text-white"
                              : "bg-slate-100 text-slate-500"
                      }`}>
                        {rank}
                      </span>

                      {/* Avatar */}
                      <img
                        src={athlete.avatarUrl || AVATAR_MALE}
                        alt={athlete.name}
                        className="w-9 h-9 rounded-full object-cover border border-slate-200"
                        referrerPolicy="no-referrer"
                      />

                      {/* Info */}
                      <div className="min-w-0">
                        <span className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100 block truncate leading-tight">
                          {athlete.name}
                        </span>
                        
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-400 mt-0.5">
                          <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded font-bold text-slate-650">{language === "en" ? "ID:" : "Mã số:"} {athlete.id}</span>
                          {athlete.team && (
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold max-w-[100px] truncate" title={athlete.team}>{athlete.team}</span>
                          )}
                          {athlete.isPrimaryTeam && (
                            <span className="px-1 text-[8.5px] font-extrabold uppercase bg-emerald-50 text-emerald-700 rounded border border-emerald-200 shadow-xs shrink-0 select-none">
                              {language === "en" ? "Main" : "Bắn chính"}
                            </span>
                          )}
                          {dashboardTab === "survival" && (
                            <span className="px-1 text-[8.5px] font-extrabold uppercase bg-indigo-50 text-indigo-700 rounded border border-indigo-200 shrink-0">
                              {language === "en" ? "Survival Round:" : "Vòng sống sót:"} {athlete.survivalVal === activeDistances.length ? (language === "en" ? "All" : "Toàn bộ") : `${athlete.survivalVal}`} {athlete.survivalVal < activeDistances.length && activeDistances[athlete.survivalVal] ? (language === "en" ? `(Eliminated at ${activeDistances[athlete.survivalVal].distance}m)` : `(Loại ở ${activeDistances[athlete.survivalVal].distance}m)`) : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Score detail block */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-[9px] text-gray-400 font-bold block leading-none font-sans uppercase">{language === "en" ? "Accuracy" : "Độ Trúng"}</span>
                        <span className="text-xs sm:text-sm font-bold font-mono text-emerald-600 block leading-tight">
                          {athlete.displayAccuracy.toFixed(1)}%
                        </span>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-950/40 p-2.5 rounded-xl border border-blue-100/50 text-right min-w-[70px]">
                        <span className="text-[8px] text-blue-500 font-black block leading-none font-sans uppercase tracking-wider">{language === "en" ? "Total Points" : "Tổng Điểm"}</span>
                        <span className="text-sm sm:text-base font-black font-mono text-blue-700 dark:text-blue-400 block leading-none mt-1">
                          {athlete.displayScore}
                        </span>
                      </div>
                    </div>

                  </div>
                );
              })
            )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-6 pt-4 border-t border-gray-100 dark:border-slate-800">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              className="px-3 py-1.5 rounded-lg text-xs font-black bg-slate-100 dark:bg-slate-805 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 transition-all border border-slate-250 dark:border-slate-700 cursor-pointer"
            >
              {language === "en" ? "Prev" : "Trước"}
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              const isFirst = page === 1;
              const isLast = page === totalPages;
              const isNear = Math.abs(page - currentPage) <= 1;
              
              if (!isFirst && !isLast && !isNear) {
                if (page === 2 || page === totalPages - 1) {
                  return <span key={`dots-${page}`} className="px-1 text-xs text-gray-400 font-bold select-none">...</span>;
                }
                return null;
              }
              
              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    currentPage === page
                      ? "bg-blue-600 dark:bg-blue-700 text-white shadow-sm"
                      : "bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                  }`}
                >
                  {page}
                </button>
              );
            })}
            
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              className="px-3 py-1.5 rounded-lg text-xs font-black bg-slate-100 dark:bg-slate-805 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 transition-all border border-slate-250 dark:border-slate-700 cursor-pointer"
            >
              {language === "en" ? "Next" : "Tiếp"}
            </button>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-400 font-bold block text-center uppercase tracking-wide">
          {language === "en" ? "VIETNAM SLINGSHOT CLUB (VSC / Vietnam.Slingshot)" : "CÂU LẠC BỘ BẮN NÁ CAO SU VIỆT NAM (VSC / Vietnam.Slingshot)"}
        </div>

      </div>

      </div>
    );
  };
