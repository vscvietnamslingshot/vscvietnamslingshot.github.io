import React, { useState, useMemo, useRef } from "react";
import { toPng, toJpeg } from "html-to-image";
import JSZip from "jszip";
import { 
  X, 
  Download, 
  Share2, 
  Sparkles, 
  Image as ImageIcon, 
  Check, 
  Loader2, 
  FolderLock, 
  Smartphone, 
  Laptop,
  CheckCircle2,
  Info,
  Trophy,
  Shield,
  Target,
  Users,
  Medal,
  Award,
  Star
} from "lucide-react";
import { Athlete, DistanceConfig } from "../types";
import { VSCLogo } from "./VSCLogo";
import { getHitCount, calculateRounds } from "../utils/qualification";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchName: string;
  athletes: Athlete[]; // This contains the currently active athletes participating
  distances: DistanceConfig[];
  shotsCount: number;
  directMaxShots?: number;
  teamDirectMaxShots?: number;
  competitionMode?: "individual" | "team";
  directMaxPoints?: number;
  teamDirectMaxPoints?: number;
  activeTab?: string;
  indAthletes?: Athlete[];
  indDistances?: DistanceConfig[];
  indShotsCount?: number;
  teamAthletes?: Athlete[];
  teamDistances?: DistanceConfig[];
  teamShotsCount?: number;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  matchName,
  athletes,
  distances,
  shotsCount,
  directMaxShots,
  teamDirectMaxShots,
  competitionMode,
  directMaxPoints,
  teamDirectMaxPoints,
  activeTab,
  indAthletes,
  indDistances,
  indShotsCount,
  teamAthletes,
  teamDistances,
  teamShotsCount,
}) => {
  const isDirectMode = shotsCount === 1;
  const effectiveShotsCount = isDirectMode
    ? (competitionMode === "team" ? (teamDirectMaxShots || 10) : (directMaxShots || 10))
    : shotsCount;
  const effectiveDirectMaxPoints = competitionMode === "team" ? teamDirectMaxPoints : directMaxPoints;
  // Config States
  const [selectedTabs, setSelectedTabs] = useState({
    dashboard: true,
    scoringIndividual: true,
    leaderboardIndividual: true,
    scoringTeam: true,
    leaderboardTeam: true,
    teams: true,
  });

  // Auto-select corresponding toggle on open
  React.useEffect(() => {
    if (isOpen) {
      if (activeTab === "dashboard") {
        setSelectedTabs({ dashboard: true, scoringIndividual: false, leaderboardIndividual: false, scoringTeam: false, leaderboardTeam: false, teams: false });
      } else if (activeTab === "scoring" || activeTab === "input_scores") {
        if (competitionMode === "team") {
          setSelectedTabs({ dashboard: false, scoringIndividual: false, leaderboardIndividual: false, scoringTeam: true, leaderboardTeam: false, teams: false });
        } else {
          setSelectedTabs({ dashboard: false, scoringIndividual: true, leaderboardIndividual: false, scoringTeam: false, leaderboardTeam: false, teams: false });
        }
      } else if (activeTab === "leaderboard") {
        if (competitionMode === "team") {
          setSelectedTabs({ dashboard: false, scoringIndividual: false, leaderboardIndividual: false, scoringTeam: false, leaderboardTeam: true, teams: false });
        } else {
          setSelectedTabs({ dashboard: false, scoringIndividual: false, leaderboardIndividual: true, scoringTeam: false, leaderboardTeam: false, teams: false });
        }
      } else if (activeTab === "teams") {
        setSelectedTabs({ dashboard: false, scoringIndividual: false, leaderboardIndividual: false, scoringTeam: false, leaderboardTeam: false, teams: true });
      } else {
        setSelectedTabs({ dashboard: true, scoringIndividual: true, leaderboardIndividual: true, scoringTeam: true, leaderboardTeam: true, teams: true });
      }
    }
  }, [isOpen, activeTab, competitionMode]);

  const [imageFormat, setImageFormat] = useState<"png" | "jpg">("png");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [exportSuccess, setExportSuccess] = useState(false);

  // Reference for the capture section
  const exportContainerRef = useRef<HTMLDivElement>(null);

  // Helper to read hit count cleanly
  const getLeaderboardHitCount = (hits: any[]) => {
    if (isDirectMode && hits[0] !== null && hits[0] !== undefined) {
      const parsed = Number(hits[0]);
      return isNaN(parsed) ? 0 : parsed;
    }
    return hits ? hits.filter(Boolean).length : 0;
  };

  const isPointModeActive = isDirectMode && effectiveDirectMaxPoints !== undefined && effectiveDirectMaxPoints > 0;

  // 1. CÁ NHÂN (INDIVIDUAL) ENVIRONMENT CALCULATIONS
  const actualIndAthletes = indAthletes || athletes;
  const actualIndDistances = indDistances || distances;
  const actualIndShotsCount = indShotsCount !== undefined ? indShotsCount : shotsCount;
  const indIsDirectMode = actualIndShotsCount === 1;

  const getLeaderboardHitCountIndividual = (hits: any[]) => {
    if (indIsDirectMode && hits[0] !== null && hits[0] !== undefined) {
      const parsed = Number(hits[0]);
      return isNaN(parsed) ? 0 : parsed;
    }
    return hits ? hits.filter(Boolean).length : 0;
  };

  const effectiveShotsCountIndividual = indIsDirectMode ? (directMaxShots || 10) : actualIndShotsCount;
  const effectiveDirectMaxPointsIndividual = directMaxPoints;
  const isPointModeActiveIndividual = indIsDirectMode && effectiveDirectMaxPointsIndividual !== undefined && effectiveDirectMaxPointsIndividual > 0;
  
  const activeAthletesIndividual = actualIndAthletes;

  const roundResultsIndividual = useMemo(() => {
    return calculateRounds(activeAthletesIndividual, actualIndDistances, effectiveShotsCountIndividual, effectiveDirectMaxPointsIndividual);
  }, [activeAthletesIndividual, actualIndDistances, effectiveShotsCountIndividual, effectiveDirectMaxPointsIndividual]);

  const athletesWithSurvivalIndividual = useMemo(() => {
    const hasMaxRoundScoreConf = actualIndDistances.some(d => d.isMaxRoundScore);

    return activeAthletesIndividual.map((athlete) => {
      let eliminatedInRoundIdx: number | null = null;
      let isSoloPendingGlobal = false;
      let isResoloPendingGlobal = false;

      for (let i = 0; i < roundResultsIndividual.length; i++) {
        let hasSubsequentParticipation = false;
        for (let j = i + 1; j < roundResultsIndividual.length; j++) {
          if (roundResultsIndividual[j].qualifiedIds.includes(athlete.id)) {
            hasSubsequentParticipation = true;
            break;
          }
        }
        if (hasSubsequentParticipation) {
          continue;
        }

        if (roundResultsIndividual[i].pendingSoloIds?.includes(athlete.id)) {
          isSoloPendingGlobal = true;
          break;
        }
        if (roundResultsIndividual[i].pendingResoloIds?.includes(athlete.id)) {
          isResoloPendingGlobal = true;
          break;
        }
        if (roundResultsIndividual[i].eliminatedIds.includes(athlete.id)) {
          eliminatedInRoundIdx = i;
          break;
        }
      }

      const survivalVal = eliminatedInRoundIdx === null ? actualIndDistances.length : eliminatedInRoundIdx;
      const lastActiveRoundIdx = eliminatedInRoundIdx === null ? (actualIndDistances.length - 1) : eliminatedInRoundIdx;

      let survivalScore = 0;
      let survivalHits = 0;
      let survivalAccuracy = 0;
      let survivalSoloHits = 0;

      if (actualIndDistances.length > 0 && lastActiveRoundIdx >= 0) {
        if (hasMaxRoundScoreConf) {
          let maxScore = -1;
          let maxHits = 0;
          let maxAccuracy = 0;
          let maxSoloHits = 0;

          let cumulativeHitsSumInShotRounds = 0;
          let cumulativeScoreSumInShotRounds = 0;
          let cumulativeMultiplierSumInShotRounds = 0;
          let cumulativeCountInShotRounds = 0;

          for (let i = 0; i <= lastActiveRoundIdx; i++) {
            const isQualifiedForRound = i === 0 || roundResultsIndividual[i]?.qualifiedIds.includes(athlete.id);

            if (isQualifiedForRound) {
              const dist = actualIndDistances[i];
              const hits = athlete.scores[dist.id] || [];
              const hitCount = getLeaderboardHitCountIndividual(hits);
              const score = hitCount * dist.multiplier;

              const wasShot = hits.length > 0 && hits.some(v => v !== null && v !== undefined);
              if (wasShot) {
                cumulativeHitsSumInShotRounds += hitCount;
                cumulativeScoreSumInShotRounds += score;
                cumulativeMultiplierSumInShotRounds += dist.multiplier;
                cumulativeCountInShotRounds++;
              }

              let accuracy = 0;
              if (isPointModeActiveIndividual && effectiveDirectMaxPointsIndividual !== undefined) {
                const totalPossPoints = effectiveDirectMaxPointsIndividual * dist.multiplier;
                accuracy = totalPossPoints > 0 ? (score / totalPossPoints) * 100 : 0;
              } else {
                accuracy = effectiveShotsCountIndividual > 0 ? (hitCount / effectiveShotsCountIndividual) * 100 : 0;
              }

              const soloHits = dist.isSolo ? (athlete.soloHits?.[dist.id] || 0) : 0;

              if (score > maxScore) {
                maxScore = score;
                maxHits = hitCount;
                maxAccuracy = accuracy;
                maxSoloHits = soloHits;
              }
            }
          }

          survivalScore = maxScore >= 0 ? maxScore : 0;
          survivalHits = maxHits;
          if (isPointModeActiveIndividual && effectiveDirectMaxPointsIndividual !== undefined) {
            if (cumulativeMultiplierSumInShotRounds === 0 && actualIndDistances[lastActiveRoundIdx]) {
              cumulativeMultiplierSumInShotRounds = actualIndDistances[lastActiveRoundIdx].multiplier;
            }
            const totalPossPoints = effectiveDirectMaxPointsIndividual * cumulativeMultiplierSumInShotRounds;
            survivalAccuracy = totalPossPoints > 0 ? (cumulativeScoreSumInShotRounds / totalPossPoints) * 100 : 0;
          } else {
            if (cumulativeCountInShotRounds === 0) {
              cumulativeCountInShotRounds = 1;
            }
            const totalPossShots = cumulativeCountInShotRounds * effectiveShotsCountIndividual;
            survivalAccuracy = totalPossShots > 0 ? (cumulativeHitsSumInShotRounds / totalPossShots) * 100 : 0;
          }
          survivalSoloHits = maxSoloHits;
        } else {
          const statsAtLastRound = roundResultsIndividual[lastActiveRoundIdx]?.scores[athlete.id];
          if (statsAtLastRound) {
            survivalScore = statsAtLastRound.cumulativeScore;
            survivalHits = statsAtLastRound.cumulativeHits;
            if (isPointModeActiveIndividual && effectiveDirectMaxPointsIndividual !== undefined) {
              let totalMultiplier = 0;
              for (let i = 0; i <= lastActiveRoundIdx; i++) {
                const d = actualIndDistances[i];
                const wasShot = athlete.scores[d.id] && athlete.scores[d.id].length > 0 && athlete.scores[d.id].some(v => v !== null && v !== undefined);
                if (wasShot) {
                  totalMultiplier += d.multiplier;
                }
              }
              if (totalMultiplier === 0 && actualIndDistances[lastActiveRoundIdx]) {
                totalMultiplier = actualIndDistances[lastActiveRoundIdx].multiplier;
              }
              const totalPossPoints = effectiveDirectMaxPointsIndividual * totalMultiplier;
              survivalAccuracy = totalPossPoints > 0 ? (survivalScore / totalPossPoints) * 100 : 0;
            } else {
              let shotRoundsCount = 0;
              for (let i = 0; i <= lastActiveRoundIdx; i++) {
                const d = actualIndDistances[i];
                const wasShot = athlete.scores[d.id] && athlete.scores[d.id].length > 0 && athlete.scores[d.id].some(v => v !== null && v !== undefined);
                if (wasShot) {
                  shotRoundsCount++;
                }
              }
              if (shotRoundsCount === 0) {
                shotRoundsCount = 1;
              }
              const totalPossShots = shotRoundsCount * effectiveShotsCountIndividual;
              survivalAccuracy = totalPossShots > 0 ? (survivalHits / totalPossShots) * 100 : 0;
            }
          }
          const lastActiveDist = actualIndDistances[lastActiveRoundIdx];
          if (lastActiveDist && lastActiveDist.isSolo) {
            survivalSoloHits = athlete.soloHits?.[lastActiveDist.id] || 0;
          }
        }
      }

      return {
        athlete,
        survivalScore,
        survivalHits,
        survivalVal,
        survivalAccuracy,
        survivalSoloHits,
        eliminatedInRoundIdx,
      };
    });
  }, [activeAthletesIndividual, actualIndDistances, roundResultsIndividual, isPointModeActiveIndividual, effectiveDirectMaxPointsIndividual, effectiveShotsCountIndividual]);

  const leaderboardDataIndividual = useMemo(() => {
    const sorted = [...athletesWithSurvivalIndividual].sort((a, b) => {
      const isABỏThi = a.athlete.status === "Bỏ thi";
      const isBBỏThi = b.athlete.status === "Bỏ thi";
      if (isABỏThi && !isBBỏThi) return 1;
      if (!isABỏThi && isBBỏThi) return -1;

      if (b.survivalVal !== a.survivalVal) {
        return b.survivalVal - a.survivalVal;
      }
      if (b.survivalScore !== a.survivalScore) {
        return b.survivalScore - a.survivalScore;
      }
      if (b.survivalSoloHits !== a.survivalSoloHits) {
        return b.survivalSoloHits - a.survivalSoloHits;
      }
      if (b.survivalAccuracy !== a.survivalAccuracy) {
        return b.survivalAccuracy - a.survivalAccuracy;
      }
      return a.athlete.name.localeCompare(b.athlete.name, "vi");
    });

    return sorted.map((item, idx) => {
      let betterCount = 0;
      const athlete = item.athlete;

      for (let j = 0; j < idx; j++) {
        const other = sorted[j];
        if (other.athlete.status === "Bỏ thi") continue;

        if (other.survivalVal !== item.survivalVal) {
          if (other.survivalVal > item.survivalVal) betterCount++;
        } else if (other.survivalScore !== item.survivalScore) {
          if (other.survivalScore > item.survivalScore) betterCount++;
        } else if (other.survivalSoloHits !== item.survivalSoloHits) {
          if (other.survivalSoloHits > item.survivalSoloHits) betterCount++;
        } else if (other.survivalAccuracy !== item.survivalAccuracy) {
          if (other.survivalAccuracy > item.survivalAccuracy) betterCount++;
        }
      }

      return {
        ...athlete,
        totalScore: item.survivalScore,
        totalHits: item.survivalHits,
        accuracy: item.survivalAccuracy,
        survivalVal: item.survivalVal,
        baseRank: betterCount + 1,
        eliminatedInRoundIdx: item.eliminatedInRoundIdx,
      };
    });
  }, [athletesWithSurvivalIndividual]);


  // 2. ĐỒNG ĐỘI (TEAM) ENVIRONMENT CALCULATIONS
  const actualTeamAthletes = teamAthletes || athletes;
  const actualTeamDistances = teamDistances || distances;
  const actualTeamShotsCount = teamShotsCount !== undefined ? teamShotsCount : shotsCount;
  const teamIsDirectMode = actualTeamShotsCount === 1;

  const getLeaderboardHitCountTeam = (hits: any[]) => {
    if (teamIsDirectMode && hits[0] !== null && hits[0] !== undefined) {
      const parsed = Number(hits[0]);
      return isNaN(parsed) ? 0 : parsed;
    }
    return hits ? hits.filter(Boolean).length : 0;
  };

  const effectiveShotsCountTeam = teamIsDirectMode ? (teamDirectMaxShots || 10) : actualTeamShotsCount;
  const effectiveDirectMaxPointsTeam = teamDirectMaxPoints;
  const isPointModeActiveTeam = teamIsDirectMode && effectiveDirectMaxPointsTeam !== undefined && effectiveDirectMaxPointsTeam > 0;
  
  const activeAthletesTeam = useMemo(() => {
    return actualTeamAthletes.filter((a) => a.isPrimaryTeam);
  }, [actualTeamAthletes]);

  const roundResultsTeam = useMemo(() => {
    return calculateRounds(activeAthletesTeam, actualTeamDistances, effectiveShotsCountTeam, effectiveDirectMaxPointsTeam);
  }, [activeAthletesTeam, actualTeamDistances, effectiveShotsCountTeam, effectiveDirectMaxPointsTeam]);

  const teamRoundResultsTeam = useMemo(() => {
    const results: any[] = [];
    const teamCumulativeScores: Record<string, number> = {};
    const teamCumulativeHits: Record<string, number> = {};

    const activeTeams = Array.from(new Set(activeAthletesTeam.map((a) => {
      const raw = a.team.trim();
      return raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
    }))) as string[];

    for (let r = 0; r < actualTeamDistances.length; r++) {
      const dist = actualTeamDistances[r];
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

      const currentRoundTeams = Array.from(new Set(activeAthletesTeam.map((a) => {
        const raw = a.team.trim();
        return raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
      }))).filter((tName) => activeTeams.includes(tName as string)) as string[];

      currentRoundTeams.forEach((teamName: string) => {
        const members = activeAthletesTeam.filter((a) => {
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
          roundHits += getLeaderboardHitCountTeam(hits);
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
        if (teamIsDirectMode && teamDirectMaxPoints !== undefined && teamDirectMaxPoints > 0) {
          let totalMultiplier = 0;
          if (dist.isCumulative) {
            for (let i = 0; i <= r; i++) {
              totalMultiplier += actualTeamDistances[i].multiplier;
            }
          } else {
            totalMultiplier = dist.multiplier;
          }
          const totalPossPoints = activeMembers.length * teamDirectMaxPoints * totalMultiplier;
          accuracy = Math.min(100, totalPossPoints > 0 ? (displayScore / totalPossPoints) * 100 : 0);
        } else {
          const totalPossShots = activeMembers.length * (dist.isCumulative ? (r + 1) * effectiveShotsCountTeam : effectiveShotsCountTeam);
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
          N = Math.max(1, Math.round(sortedTeams.length * (elimVal / 105))); // standard ratio
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
  }, [activeAthletesTeam, actualTeamDistances, effectiveShotsCountTeam, teamIsDirectMode, teamDirectMaxPoints]);

  const activeTeamScoresTeam = useMemo(() => {
    const scores: Record<string, number> = {};
    const hasMaxRoundScoreConf = actualTeamDistances.some(d => d.isMaxRoundScore);

    if (hasMaxRoundScoreConf) {
      const teamsList = Array.from(new Set(activeAthletesTeam.map((a) => {
        const raw = a.team.trim();
        return raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
      }))) as string[];

      teamsList.forEach((teamName) => {
        const members = activeAthletesTeam.filter((a) => {
          const raw = a.team.trim();
          const t = raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
          return t === teamName && a.isPrimaryTeam && a.status !== "Bỏ thi";
        });

        let teamScoreSum = 0;
        let teamSoloSum = 0;

        members.forEach((athlete) => {
          let maxScore = -1;
          let maxSoloHits = 0;

          actualTeamDistances.forEach((distance, rIdx) => {
            const isQualified = rIdx === 0 || (teamRoundResultsTeam[rIdx]?.qualifiedTeams.includes(teamName));
            if (isQualified) {
              const hits = athlete.scores[distance.id] || [];
              const hitCount = getLeaderboardHitCountTeam(hits);
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
      activeAthletesTeam.forEach((athlete) => {
        if (!athlete.isPrimaryTeam) return;

        const rawTeam = athlete.team.trim();
        const teamName = rawTeam === "" ? "VĐV Tự Do (Không Đội)" : rawTeam;

        let personalScore = 0;
        let personalSolo = 0;
        actualTeamDistances.forEach((distance, rIdx) => {
          const isQualified = rIdx === 0 || (teamRoundResultsTeam[rIdx]?.qualifiedTeams.includes(teamName));
          if (isQualified) {
            const hits = athlete.scores[distance.id] || [];
            const hitCount = getLeaderboardHitCountTeam(hits);
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
  }, [activeAthletesTeam, actualTeamDistances, teamRoundResultsTeam, teamIsDirectMode, teamDirectMaxPoints, effectiveShotsCountTeam]);

  const teamRanksTeam = useMemo(() => {
    const teamStats: Record<string, { survivalVal: number; score: number }> = {};
    activeAthletesTeam.forEach((ath) => {
      const rawTeam = ath.team.trim();
      const teamName = rawTeam === "" ? "VĐV Tự Do (Không Đội)" : rawTeam;
      if (!teamStats[teamName]) {
        let eliminatedInRoundIdx: number | null = null;
        for (let i = 0; i < teamRoundResultsTeam.length; i++) {
          if (teamRoundResultsTeam[i].eliminatedTeams.includes(teamName)) {
            eliminatedInRoundIdx = i;
            break;
          }
        }
        const sVal = eliminatedInRoundIdx === null ? actualTeamDistances.length : eliminatedInRoundIdx;
        teamStats[teamName] = {
          survivalVal: sVal,
          score: activeTeamScoresTeam[teamName] || 0,
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
  }, [activeAthletesTeam, actualTeamDistances, teamRoundResultsTeam, activeTeamScoresTeam]);

  const athletesWithSurvivalTeam = useMemo(() => {
    const hasMaxRoundScoreConf = actualTeamDistances.some(d => d.isMaxRoundScore);

    return activeAthletesTeam.map((athlete) => {
      let eliminatedInRoundIdx: number | null = null;
      let isSoloPendingGlobal = false;
      let isResoloPendingGlobal = false;

      const raw = athlete.team.trim();
      const teamName = raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
      for (let i = 0; i < teamRoundResultsTeam.length; i++) {
        if (teamRoundResultsTeam[i].eliminatedTeams.includes(teamName)) {
          eliminatedInRoundIdx = i;
          break;
        }
      }

      for (let i = 0; i < teamRoundResultsTeam.length; i++) {
        if (teamRoundResultsTeam[i].pendingSoloTeams?.includes(teamName)) {
          isSoloPendingGlobal = true;
          break;
        }
        if (teamRoundResultsTeam[i].pendingResoloTeams?.includes(teamName)) {
          isResoloPendingGlobal = true;
          break;
        }
      }

      const survivalVal = eliminatedInRoundIdx === null ? actualTeamDistances.length : eliminatedInRoundIdx;
      const lastActiveRoundIdx = eliminatedInRoundIdx === null ? (actualTeamDistances.length - 1) : eliminatedInRoundIdx;

      let survivalScore = 0;
      let survivalHits = 0;
      let survivalAccuracy = 0;
      let survivalSoloHits = 0;

      if (actualTeamDistances.length > 0 && lastActiveRoundIdx >= 0) {
        if (hasMaxRoundScoreConf) {
          let maxScore = -1;
          let maxHits = 0;
          let maxAccuracy = 0;
          let maxSoloHits = 0;

          let cumulativeHitsSumInShotRounds = 0;
          let cumulativeScoreSumInShotRounds = 0;
          let cumulativeMultiplierSumInShotRounds = 0;
          let cumulativeCountInShotRounds = 0;

          for (let i = 0; i <= lastActiveRoundIdx; i++) {
            const isQualifiedForRound = i === 0 || teamRoundResultsTeam[i]?.qualifiedTeams.includes(teamName);

            if (isQualifiedForRound) {
              const dist = actualTeamDistances[i];
              const hits = athlete.scores[dist.id] || [];
              const hitCount = getLeaderboardHitCountTeam(hits);
              const score = hitCount * dist.multiplier;

              const wasShot = hits.length > 0 && hits.some(v => v !== null && v !== undefined);
              if (wasShot) {
                cumulativeHitsSumInShotRounds += hitCount;
                cumulativeScoreSumInShotRounds += score;
                cumulativeMultiplierSumInShotRounds += dist.multiplier;
                cumulativeCountInShotRounds++;
              }

              let accuracy = 0;
              if (isPointModeActiveTeam && effectiveDirectMaxPointsTeam !== undefined) {
                const totalPossPoints = effectiveDirectMaxPointsTeam * dist.multiplier;
                accuracy = totalPossPoints > 0 ? (score / totalPossPoints) * 100 : 0;
              } else {
                accuracy = effectiveShotsCountTeam > 0 ? (hitCount / effectiveShotsCountTeam) * 100 : 0;
              }

              const soloHits = dist.isSolo ? (athlete.soloHits?.[dist.id] || 0) : 0;

              if (score > maxScore) {
                maxScore = score;
                maxHits = hitCount;
                maxAccuracy = accuracy;
                maxSoloHits = soloHits;
              }
            }
          }

          survivalScore = maxScore >= 0 ? maxScore : 0;
          survivalHits = maxHits;
          if (isPointModeActiveTeam && effectiveDirectMaxPointsTeam !== undefined) {
            if (cumulativeMultiplierSumInShotRounds === 0 && actualTeamDistances[lastActiveRoundIdx]) {
              cumulativeMultiplierSumInShotRounds = actualTeamDistances[lastActiveRoundIdx].multiplier;
            }
            const totalPossPoints = effectiveDirectMaxPointsTeam * cumulativeMultiplierSumInShotRounds;
            survivalAccuracy = totalPossPoints > 0 ? (cumulativeScoreSumInShotRounds / totalPossPoints) * 100 : 0;
          } else {
            if (cumulativeCountInShotRounds === 0) {
              cumulativeCountInShotRounds = 1;
            }
            const totalPossShots = cumulativeCountInShotRounds * effectiveShotsCountTeam;
            survivalAccuracy = totalPossShots > 0 ? (cumulativeHitsSumInShotRounds / totalPossShots) * 100 : 0;
          }
          survivalSoloHits = maxSoloHits;
        } else {
          const statsAtLastRound = roundResultsTeam[lastActiveRoundIdx]?.scores[athlete.id];
          if (statsAtLastRound) {
            survivalScore = statsAtLastRound.cumulativeScore;
            survivalHits = statsAtLastRound.cumulativeHits;
            if (isPointModeActiveTeam && effectiveDirectMaxPointsTeam !== undefined) {
              let totalMultiplier = 0;
              for (let i = 0; i <= lastActiveRoundIdx; i++) {
                const d = actualTeamDistances[i];
                const wasShot = athlete.scores[d.id] && athlete.scores[d.id].length > 0 && athlete.scores[d.id].some(v => v !== null && v !== undefined);
                if (wasShot) {
                  totalMultiplier += d.multiplier;
                }
              }
              if (totalMultiplier === 0 && actualTeamDistances[lastActiveRoundIdx]) {
                totalMultiplier = actualTeamDistances[lastActiveRoundIdx].multiplier;
              }
              const totalPossPoints = effectiveDirectMaxPointsTeam * totalMultiplier;
              survivalAccuracy = totalPossPoints > 0 ? (survivalScore / totalPossPoints) * 100 : 0;
            } else {
              let shotRoundsCount = 0;
              for (let i = 0; i <= lastActiveRoundIdx; i++) {
                const d = actualTeamDistances[i];
                const wasShot = athlete.scores[d.id] && athlete.scores[d.id].length > 0 && athlete.scores[d.id].some(v => v !== null && v !== undefined);
                if (wasShot) {
                  shotRoundsCount++;
                }
              }
              if (shotRoundsCount === 0) {
                shotRoundsCount = 1;
              }
              const totalPossShots = shotRoundsCount * effectiveShotsCountTeam;
              survivalAccuracy = totalPossShots > 0 ? (survivalHits / totalPossShots) * 100 : 0;
            }
          }
          const lastActiveDist = actualTeamDistances[lastActiveRoundIdx];
          if (lastActiveDist && lastActiveDist.isSolo) {
            survivalSoloHits = athlete.soloHits?.[lastActiveDist.id] || 0;
          }
        }
      }

      return {
        athlete,
        survivalScore,
        survivalHits,
        survivalVal,
        survivalAccuracy,
        survivalSoloHits,
        eliminatedInRoundIdx,
      };
    });
  }, [activeAthletesTeam, actualTeamDistances, roundResultsTeam, teamRoundResultsTeam, isPointModeActiveTeam, effectiveDirectMaxPointsTeam, effectiveShotsCountTeam]);

  const leaderboardDataTeam = useMemo(() => {
    const sorted = [...athletesWithSurvivalTeam].sort((a, b) => {
      const isABỏThi = a.athlete.status === "Bỏ thi";
      const isBBỏThi = b.athlete.status === "Bỏ thi";
      if (isABỏThi && !isBBỏThi) return 1;
      if (!isABỏThi && isBBỏThi) return -1;

      const teamNameA = a.athlete.team.trim() === "" ? "VĐV Tự Do (Không Đội)" : a.athlete.team.trim();
      const teamNameB = b.athlete.team.trim() === "" ? "VĐV Tự Do (Không Đội)" : b.athlete.team.trim();
      const scoreA = activeTeamScoresTeam[teamNameA] || 0;
      const scoreB = activeTeamScoresTeam[teamNameB] || 0;

      // 1. Compare team survival / active status
      if (b.survivalVal !== a.survivalVal) {
        return b.survivalVal - a.survivalVal;
      }

      // 2. Compare team scores
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }

      // Alphabetical team name grouping
      const teamNameComp = teamNameA.localeCompare(teamNameB, "vi");
      if (teamNameComp !== 0) {
        return teamNameComp;
      }

      // Tie-breaker within same team
      const totalScoreA = a.survivalScore;
      const totalScoreB = b.survivalScore;
      if (totalScoreB !== totalScoreA) {
        return totalScoreB - totalScoreA;
      }
      return b.survivalAccuracy - a.survivalAccuracy;
    });

    return sorted.map((item, idx) => {
      let betterCount = 0;
      const athlete = item.athlete;

      for (let j = 0; j < idx; j++) {
        const other = sorted[j];
        if (other.athlete.status === "Bỏ thi") continue;

        const teamNameSelf = athlete.team.trim() === "" ? "VĐV Tự Do (Không Đội)" : athlete.team.trim();
        const teamNameOther = other.athlete.team.trim() === "" ? "VĐV Tự Do (Không Đội)" : other.athlete.team.trim();
        const scoreSelf = activeTeamScoresTeam[teamNameSelf] || 0;
        const scoreOther = activeTeamScoresTeam[teamNameOther] || 0;

        if (other.survivalVal !== item.survivalVal) {
          if (other.survivalVal > item.survivalVal) betterCount++;
        } else if (scoreOther !== scoreSelf) {
          if (scoreOther > scoreSelf) betterCount++;
        } else if (teamNameOther !== teamNameSelf) {
          if (teamNameOther.localeCompare(teamNameSelf, "vi") < 0) {
            betterCount++;
          }
        } else {
          if (other.survivalScore > item.survivalScore) {
            betterCount++;
          } else if (other.survivalScore === item.survivalScore) {
            if (other.survivalAccuracy > item.survivalAccuracy) {
              betterCount++;
            }
          }
        }
      }

      return {
        ...athlete,
        totalScore: item.survivalScore,
        totalHits: item.survivalHits,
        accuracy: item.survivalAccuracy,
        survivalVal: item.survivalVal,
        baseRank: betterCount + 1,
        eliminatedInRoundIdx: item.eliminatedInRoundIdx,
      };
    });
  }, [athletesWithSurvivalTeam, activeTeamScoresTeam]);

  // Construct team standings (Trụ lại Cuối Cùng) for Team Environment
  const teamsDataTeam = useMemo(() => {
    const teamNames = Array.from(new Set(activeAthletesTeam.map((a) => {
      const raw = a.team.trim();
      return raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
    }))) as string[];

    const teamsArray = teamNames.map((teamName) => {
      const members = activeAthletesTeam.filter((a) => {
        const raw = a.team.trim();
        const t = raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
        return t === teamName && a.status !== "Bỏ thi";
      });

      const totalScore = activeTeamScoresTeam[teamName] || 0;

      let totalHits = 0;
      let totalShots = 0;

      members.forEach((athlete) => {
        actualTeamDistances.forEach((dist, rIdx) => {
          const isQualified = rIdx === 0 || (teamRoundResultsTeam[rIdx]?.qualifiedTeams.includes(teamName));
          if (isQualified) {
            const hits = athlete.scores[dist.id] || [];
            totalHits += getLeaderboardHitCountTeam(hits);
            totalShots += effectiveShotsCountTeam;
          }
        });
      });

      let survivalVal = actualTeamDistances.length;
      for (let i = 0; i < teamRoundResultsTeam.length; i++) {
        if (teamRoundResultsTeam[i].eliminatedTeams.includes(teamName)) {
          survivalVal = i;
          break;
        }
      }

      const sortedMembers = members.map(m => {
        const matchingSurvival = athletesWithSurvivalTeam.find(aws => aws.athlete.id === m.id);
        return {
          id: m.id,
          name: m.name,
          totalScore: matchingSurvival ? matchingSurvival.survivalScore : 0,
          totalHits: matchingSurvival ? matchingSurvival.survivalHits : 0,
          totalShots: teamIsDirectMode ? (effectiveDirectMaxPointsTeam || effectiveShotsCountTeam) : actualTeamDistances.length * effectiveShotsCountTeam,
          accuracy: matchingSurvival ? matchingSurvival.survivalAccuracy : 0,
        };
      }).sort((a, b) => b.totalScore - a.totalScore);

      return {
        teamName,
        totalScore,
        totalHits,
        totalShots,
        averageAccuracy: sortedMembers.length > 0 ? (sortedMembers.reduce((sum, m) => sum + m.accuracy, 0) / sortedMembers.length) : 0,
        memberCount: members.length,
        members: sortedMembers,
        survivalVal,
      };
    });

    return teamsArray.sort((a, b) => {
      const rankA = teamRanksTeam[a.teamName] || 999;
      const rankB = teamRanksTeam[b.teamName] || 999;
      return rankA - rankB;
    });
  }, [activeAthletesTeam, actualTeamDistances, effectiveShotsCountTeam, activeTeamScoresTeam, teamRanksTeam, athletesWithSurvivalTeam, teamRoundResultsTeam, teamIsDirectMode, effectiveDirectMaxPointsTeam]);


  // 3. UNIFIED ENVIRONMENT RETRIEVERS (BACKWARD COMPATIBLE FALLBACKS FOR GENERAL POSTER)
  const leaderboardData = useMemo(() => {
    return competitionMode === "team" ? leaderboardDataTeam : leaderboardDataIndividual;
  }, [competitionMode, leaderboardDataTeam, leaderboardDataIndividual]);

  const dashboardHighlights = useMemo(() => {
    if (!athletes || athletes.length === 0) {
      return { avgAccuracy: 0, bestScoreValue: 0, bestScoreName: "Chưa có" };
    }
    const totalAccuracy = leaderboardDataIndividual.reduce((sum, a) => sum + (a.accuracy || 0), 0);
    const avgAccuracy = leaderboardDataIndividual.length > 0 ? totalAccuracy / leaderboardDataIndividual.length : 0;
    
    const sortedByScore = [...leaderboardDataIndividual].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
    const bestAthlete = sortedByScore[0] || null;
    
    return {
      avgAccuracy,
      bestScoreValue: bestAthlete ? (bestAthlete.totalScore || 0) : 0,
      bestScoreName: bestAthlete ? bestAthlete.name : "Chưa có",
    };
  }, [leaderboardDataIndividual, athletes]);

  const teamsData = useMemo(() => {
    if (competitionMode === "team") {
      return teamsDataTeam;
    }
    const groups: Record<string, { id: string; name: string; totalScore: number; totalHits: number; totalShots: number; accuracy: number }[]> = {};
    athletes.forEach((athlete) => {
      const rawTeam = athlete.team?.trim();
      const teamName = !rawTeam ? "VĐV Tự Do" : rawTeam;

      let totalScore = 0;
      let totalHits = 0;

      distances.forEach((dist) => {
        const hits = athlete.scores[dist.id] || [];
        const hitCount = getHitCount(hits);
        totalScore += hitCount * dist.multiplier;
        totalHits += hitCount;
      });

      const totalShots = distances.length * effectiveShotsCountIndividual;
      let accuracy = 0;
      if (isDirectMode && effectiveDirectMaxPointsIndividual !== undefined && effectiveDirectMaxPointsIndividual > 0) {
        const totalPossiblePoints = effectiveDirectMaxPointsIndividual * distances.reduce((sum, d) => sum + d.multiplier, 0);
        accuracy = totalPossiblePoints > 0 ? (totalScore / totalPossiblePoints) * 100 : 0;
      } else {
        accuracy = totalShots > 0 ? (totalHits / totalShots) * 100 : 0;
      }

      if (!groups[teamName]) {
        groups[teamName] = [];
      }
      groups[teamName].push({
        id: athlete.id,
        name: athlete.name,
        totalScore,
        totalHits,
        totalShots,
        accuracy,
      });
    });

    const teamsArray = Object.entries(groups).map(([teamName, members]) => {
      const sortedMembers = [...members].sort((a, b) => b.totalScore - a.totalScore);
      const totalScore = members.reduce((sum, m) => sum + m.totalScore, 0);
      const totalHits = members.reduce((sum, m) => sum + m.totalHits, 0);
      let averageAccuracy = 0;
      if (isDirectMode && effectiveDirectMaxPointsIndividual !== undefined && effectiveDirectMaxPointsIndividual > 0) {
        const totalPossiblePoints = members.length * effectiveDirectMaxPointsIndividual * distances.reduce((sum, d) => sum + d.multiplier, 0);
        averageAccuracy = totalPossiblePoints > 0 ? (totalScore / totalPossiblePoints) * 100 : 0;
      } else {
        const totalShotsSum = members.reduce((sum, m) => sum + m.totalShots, 0);
        averageAccuracy = totalShotsSum > 0 ? (totalHits / totalShotsSum) * 105 : 0;
        averageAccuracy = Math.min(100, totalShotsSum > 0 ? (totalHits / totalShotsSum) * 100 : 0);
      }

      return {
        teamName,
        totalScore,
        totalHits,
        totalShots: isDirectMode ? (effectiveDirectMaxPointsIndividual || effectiveShotsCountIndividual) : (distances.length * effectiveShotsCountIndividual),
        averageAccuracy,
        memberCount: members.length,
        members: sortedMembers,
        survivalVal: distances.length,
      };
    });

    return teamsArray.sort((a, b) => b.totalScore - a.totalScore);
  }, [competitionMode, teamsDataTeam, athletes, distances, effectiveShotsCountIndividual, isDirectMode, effectiveDirectMaxPointsIndividual]);

  const athletesWithSurvival = useMemo(() => {
    return competitionMode === "team" ? athletesWithSurvivalTeam : athletesWithSurvivalIndividual;
  }, [competitionMode, athletesWithSurvivalTeam, athletesWithSurvivalIndividual]);

  const activeAthletes = useMemo(() => {
    return competitionMode === "team" ? activeAthletesTeam : activeAthletesIndividual;
  }, [competitionMode, activeAthletesTeam, activeAthletesIndividual]);


  // 4. CHUNKING & PACK-PAGINATION GENERATORS
  const paginatedLeaderboardIndividualVisible = useMemo(() => {
    const pages: typeof leaderboardDataIndividual[] = [];
    let currentPage: typeof leaderboardDataIndividual = [];
    const maxPageHeight = aspectRatio === "16:9" ? 380 : 930;
    const rowHeight = aspectRatio === "16:9" ? 60 : 72;
    let currentHeightSum = 0;

    leaderboardDataIndividual.forEach((ath) => {
      if (currentPage.length === 0) {
        currentPage.push(ath);
        currentHeightSum = rowHeight;
      } else {
        if (currentHeightSum + rowHeight <= maxPageHeight) {
          currentPage.push(ath);
          currentHeightSum += rowHeight;
        } else {
          pages.push(currentPage);
          currentPage = [ath];
          currentHeightSum = rowHeight;
        }
      }
    });

    if (currentPage.length > 0) {
      pages.push(currentPage);
    }
    return pages;
  }, [leaderboardDataIndividual, aspectRatio]);

  const paginatedLeaderboardTeamVisible = useMemo(() => {
    const pages: typeof leaderboardDataTeam[] = [];
    let currentPage: typeof leaderboardDataTeam = [];
    const maxPageHeight = aspectRatio === "16:9" ? 380 : 930;
    const rowHeight = aspectRatio === "16:9" ? 60 : 72;
    let currentHeightSum = 0;

    leaderboardDataTeam.forEach((ath) => {
      if (currentPage.length === 0) {
        currentPage.push(ath);
        currentHeightSum = rowHeight;
      } else {
        if (currentHeightSum + rowHeight <= maxPageHeight) {
          currentPage.push(ath);
          currentHeightSum += rowHeight;
        } else {
          pages.push(currentPage);
          currentPage = [ath];
          currentHeightSum = rowHeight;
        }
      }
    });

    if (currentPage.length > 0) {
      pages.push(currentPage);
    }
    return pages;
  }, [leaderboardDataTeam, aspectRatio]);

  const paginatedScoringIndividualVisible = useMemo(() => {
    const pages: Athlete[][] = [];
    let currentPage: Athlete[] = [];
    const maxPageHeight = aspectRatio === "16:9" ? 405 : 980;
    let currentHeightSum = 0;
    const colGap = 16;
    const rowGap = 14;

    activeAthletesIndividual.forEach((ath) => {
      const activeDistsCount = actualIndDistances.filter((dist) => {
        const hits = ath.scores?.[dist.id];
        return hits && hits.length > 0 && hits.some(v => v !== null && v !== undefined);
      }).length;
      
      const cardHeight = 98 + (54 * Math.max(1, activeDistsCount));
      
      if (aspectRatio === "16:9") {
        if (currentPage.length === 0) {
          currentPage.push(ath);
          currentHeightSum = cardHeight;
        } else {
          const proposedPage = [...currentPage, ath];
          let colLeftVal = 0;
          let colRightVal = 0;
          proposedPage.forEach((item) => {
            const itemDistsCount = actualIndDistances.filter((dist) => {
              const hits = item.scores?.[dist.id];
              return hits && hits.length > 0 && hits.some(v => v !== null && v !== undefined);
            }).length;
            const itemHeight = 98 + (54 * Math.max(1, itemDistsCount));
            if (colLeftVal <= colRightVal) {
              colLeftVal += itemHeight + (colLeftVal > 0 ? colGap : 0);
            } else {
              colRightVal += itemHeight + (colRightVal > 0 ? colGap : 0);
            }
          });
          
          if (colLeftVal <= maxPageHeight && colRightVal <= maxPageHeight) {
            currentPage.push(ath);
          } else {
            pages.push(currentPage);
            currentPage = [ath];
          }
        }
      } else {
        if (currentPage.length === 0) {
          currentPage.push(ath);
          currentHeightSum = cardHeight;
        } else {
          if (currentHeightSum + rowGap + cardHeight <= maxPageHeight) {
            currentPage.push(ath);
            currentHeightSum += rowGap + cardHeight;
          } else {
            pages.push(currentPage);
            currentPage = [ath];
            currentHeightSum = cardHeight;
          }
        }
      }
    });
    
    if (currentPage.length > 0) {
      pages.push(currentPage);
    }
    return pages;
  }, [activeAthletesIndividual, actualIndDistances, aspectRatio]);

  const paginatedScoringTeamVisible = useMemo(() => {
    const pages: Athlete[][] = [];
    let currentPage: Athlete[] = [];
    const maxPageHeight = aspectRatio === "16:9" ? 405 : 980;
    let currentHeightSum = 0;
    const colGap = 16;
    const rowGap = 14;

    activeAthletesTeam.forEach((ath) => {
      const activeDistsCount = actualTeamDistances.filter((dist) => {
        const hits = ath.scores?.[dist.id];
        return hits && hits.length > 0 && hits.some(v => v !== null && v !== undefined);
      }).length;
      
      const cardHeight = 98 + (54 * Math.max(1, activeDistsCount));
      
      if (aspectRatio === "16:9") {
        if (currentPage.length === 0) {
          currentPage.push(ath);
          currentHeightSum = cardHeight;
        } else {
          const proposedPage = [...currentPage, ath];
          let colLeftVal = 0;
          let colRightVal = 0;
          proposedPage.forEach((item) => {
            const itemDistsCount = actualTeamDistances.filter((dist) => {
              const hits = item.scores?.[dist.id];
              return hits && hits.length > 0 && hits.some(v => v !== null && v !== undefined);
            }).length;
            const itemHeight = 98 + (54 * Math.max(1, itemDistsCount));
            if (colLeftVal <= colRightVal) {
              colLeftVal += itemHeight + (colLeftVal > 0 ? colGap : 0);
            } else {
              colRightVal += itemHeight + (colRightVal > 0 ? colGap : 0);
            }
          });
          
          if (colLeftVal <= maxPageHeight && colRightVal <= maxPageHeight) {
            currentPage.push(ath);
          } else {
            pages.push(currentPage);
            currentPage = [ath];
          }
        }
      } else {
        if (currentPage.length === 0) {
          currentPage.push(ath);
          currentHeightSum = cardHeight;
        } else {
          if (currentHeightSum + rowGap + cardHeight <= maxPageHeight) {
            currentPage.push(ath);
            currentHeightSum += rowGap + cardHeight;
          } else {
            pages.push(currentPage);
            currentPage = [ath];
            currentHeightSum = cardHeight;
          }
        }
      }
    });
    
    if (currentPage.length > 0) {
      pages.push(currentPage);
    }
    return pages;
  }, [activeAthletesTeam, actualTeamDistances, aspectRatio]);

  const paginatedTeamsTeamVisible = useMemo(() => {
    const pages: typeof teamsDataTeam[] = [];
    let currentPage: typeof teamsDataTeam = [];
    const maxPageHeight = aspectRatio === "16:9" ? 410 : 930;
    const cardHeight = aspectRatio === "16:9" ? 135 : 165;
    const rowGap = 14;
    let currentHeightSum = 0;

    teamsDataTeam.forEach((team) => {
      if (currentPage.length === 0) {
        currentPage.push(team);
        currentHeightSum = cardHeight;
      } else {
        if (currentHeightSum + rowGap + cardHeight <= maxPageHeight) {
          currentPage.push(team);
          currentHeightSum += rowGap + cardHeight;
        } else {
          pages.push(currentPage);
          currentPage = [team];
          currentHeightSum = cardHeight;
        }
      }
    });

    if (currentPage.length > 0) {
      pages.push(currentPage);
    }
    return pages;
  }, [teamsDataTeam, aspectRatio]);


  // 5. BACKWARD-COMPATIBILITY POPULATIONS FOR LEGACY REFERENCES
  const paginatedLeaderboard = paginatedLeaderboardIndividualVisible;
  const paginatedScoring = paginatedScoringIndividualVisible;
  const paginatedTeams = paginatedTeamsTeamVisible;

  // Compute qualifications and rounds results
  const roundResults = roundResultsIndividual;
  const teamRoundResults = teamRoundResultsTeam;
  const activeTeamScores = activeTeamScoresTeam;
  const teamRanks = teamRanksTeam;

  // Helper to generate initials avatar fallback / real avatar securely with high quality
  const getAvatar = (name: string, gender?: string, avatarUrl?: string, sizeClass = "w-10 h-10") => {
    if (avatarUrl && avatarUrl.trim() !== "") {
      return (
        <img
          src={avatarUrl}
          alt={name}
          className={`${sizeClass} rounded-full object-cover border-2 border-indigo-500/40 bg-slate-800 shadow-sm shrink-0`}
          referrerPolicy="no-referrer"
        />
      );
    }
    const clean = name?.trim() || "";
    const initials = clean ? clean.split(" ").slice(-1)[0][0]?.toUpperCase() : "V";
    const bg = gender === "Nữ" 
      ? "bg-gradient-to-br from-pink-500 to-rose-600 shadow-sm shadow-rose-250" 
      : "bg-gradient-to-br from-indigo-500 to-blue-600 shadow-sm shadow-blue-250";
    return (
      <div className={`${sizeClass} rounded-full flex items-center justify-center text-white font-extrabold text-[12px] shrink-0 ${bg}`}>
        {initials}
      </div>
    );
  };

  // 5. Image export execution
  const handleExport = async () => {
    if (!exportContainerRef.current) return;
    setIsExporting(true);
    setExportProgress(5);
    setProgressText("Đang khởi tạo bối cảnh đồ họa...");
    setExportSuccess(false);

    try {
      // Find all exportable page elements inside container
      const pageElements = Array.from(
        exportContainerRef.current.querySelectorAll("[data-export-page]")
      ) as HTMLDivElement[];

      if (pageElements.length === 0) {
        throw new Error("Không tìm thấy trang nào để xuất.");
      }

      const totalPages = pageElements.length;
      const images: { name: string; blob: Blob }[] = [];

      // Loop through and capture each page
      for (let i = 0; i < totalPages; i++) {
        const pageEl = pageElements[i];
        const pageId = pageEl.getAttribute("id") || `trang-${i}`;
        const pageStep = Math.round(5 + (i / totalPages) * 80);
        
        setExportProgress(pageStep);
        setProgressText(`Đang xử lý xuất ảnh ${i + 1}/${totalPages}...`);

        // Extra short wait for canvas styles to stabilize
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Capture options for high contrast sharpening
        const captureOptions = {
          pixelRatio: 2, // High DPI for crystal sharpness
          style: {
            transform: "scale(1)",
            transformOrigin: "top left",
          },
        };

        let dataUrl = "";
        if (imageFormat === "png") {
          dataUrl = await toPng(pageEl, captureOptions);
        } else {
          dataUrl = await toJpeg(pageEl, { ...captureOptions, quality: 0.95 });
        }

        // Convert base64 dataURL to Blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        images.push({
          name: `${pageId}.${imageFormat}`,
          blob,
        });
      }

      setExportProgress(90);
      setProgressText("Đang tối ưu hóa file tải xuống...");

      // Determine environment: mobile vs desktop
      const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
        navigator.userAgent
      );

      if (isMobile) {
        // Mobile direct sequential save triggers
        setProgressText("Đơn vị phát hiện: Điện thoại. Đang tải ảnh trực tiếp...");
        for (let idx = 0; idx < images.length; idx++) {
          const file = images[idx];
          const link = document.createElement("a");
          link.href = URL.createObjectURL(file.blob);
          link.download = file.name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          // Wait briefly between triggers so the browser handles them securely
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      } else {
        // Desktop zip packaging
        setProgressText("Đơn vị phát hiện: Máy tính. Đang thu nén thư mục ZIP...");
        const zip = new JSZip();
        
        images.forEach((img) => {
          zip.file(img.name, img.blob);
        });

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const zipLink = document.createElement("a");
        zipLink.href = URL.createObjectURL(zipBlob);
        
        // Clean tournament filename format
        const cleanMatchName = matchName
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/[\s_]+/g, "-");
        zipLink.download = `VSC-${cleanMatchName || "ket-qua"}-anh-chia-se.zip`;
        
        document.body.appendChild(zipLink);
        zipLink.click();
        document.body.removeChild(zipLink);
      }

      setExportProgress(100);
      setProgressText("Xuất ảnh và đóng gói thành công!");
      setExportSuccess(true);
      setTimeout(() => {
        setIsExporting(false);
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setProgressText(`Lỗi: ${err?.message || "Không thể khởi tạo ảnh canvas"}`);
      setTimeout(() => {
        setIsExporting(false);
      }, 3000);
    }
  };

  // Pre-calculate count of pages being rendered based on toggle state
  const totalRenderedPages = useMemo(() => {
    let pages = 0;
    if (selectedTabs.dashboard && athletes.length > 0) pages += 1;
    if (selectedTabs.scoringIndividual && athletes.length > 0) pages += paginatedScoringIndividualVisible.length;
    if (selectedTabs.leaderboardIndividual && athletes.length > 0) pages += paginatedLeaderboardIndividualVisible.length;
    if (selectedTabs.scoringTeam && activeAthletesTeam.length > 0) pages += paginatedScoringTeamVisible.length;
    if (selectedTabs.leaderboardTeam && activeAthletesTeam.length > 0) pages += paginatedLeaderboardTeamVisible.length;
    if (selectedTabs.teams && teamsDataTeam.length > 0) pages += paginatedTeamsTeamVisible.length;
    return pages;
  }, [
    selectedTabs,
    athletes,
    activeAthletesTeam,
    teamsDataTeam,
    paginatedScoringIndividualVisible,
    paginatedLeaderboardIndividualVisible,
    paginatedScoringTeamVisible,
    paginatedLeaderboardTeamVisible,
    paginatedTeamsTeamVisible
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
      
      {/* Outer Modal Container */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative animate-fadeIn flex flex-col max-h-[90vh]">
        
        {/* Header Title Bar */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-center border-b border-indigo-900">
          <div className="flex items-center gap-2.5">
            <Share2 className="w-5 h-5 text-amber-500 animate-pulse" />
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wider font-sans leading-none">
                Xuất ảnh thông số cuộc thi ({aspectRatio})
              </h2>
              <p className="text-[10px] text-slate-350 font-medium mt-1">
                {aspectRatio === "9:16" 
                  ? "Tạo ảnh dọc 9:16 chuyên nghiệp để chia sẻ Facebook, TikTok, Zalo Stories"
                  : "Tạo ảnh ngang 16:9 rộng rãi để báo cáo, trình chiếu màn hình lớn, Facebook Feed"}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-white/75 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all"
            disabled={isExporting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Scrollable Controls Body */}
        <div className="p-6 overflow-y-auto flex-1 gap-6 flex flex-col text-left">
          
          {/* Warning box if no athletes are registered yet */}
          {athletes.length === 0 ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-2xl text-xs text-amber-800 dark:text-amber-400 flex gap-3">
              <Info className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <strong className="block mb-0.5">Không tìm thấy dữ liệu vận động viên:</strong>
                Chưa có vận động viên nào tham gia giải nâng cao hiện tại. Hãy thêm VĐV vào giải đấu ở tab &quot;Ghi Điểm&quot; để chế độ xuất hình ảnh có đầy đủ thông tin báo cáo!
              </div>
            </div>
          ) : (
            <>
              {/* Selector matrix */}
              <div>
                <h3 className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider mb-2.5">
                  1. Chọn các bảng dữ liệu muốn xuất
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  {/* Option Dashboard */}
                  <label className={`flex items-center justify-between p-3 border-2 rounded-2xl cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-850 ${
                    selectedTabs.dashboard 
                    ? "border-blue-600 bg-blue-50/20 dark:border-blue-500 dark:bg-blue-950/20" 
                    : "border-gray-205 bg-white dark:border-slate-800 dark:bg-slate-900"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <input 
                        type="checkbox"
                        checked={selectedTabs.dashboard}
                        onChange={() => setSelectedTabs(p => ({ ...p, dashboard: !p.dashboard }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">tab Dashboard / Tổng hợp</span>
                        <span className="text-[10px] text-gray-400 block font-normal font-sans">Podium vinh danh, tỉ lệ trúng & biểu đồ (1 ảnh)</span>
                      </div>
                    </div>
                  </label>

                  {/* Option Scoring Individual */}
                  <label className={`flex items-center justify-between p-3 border-2 rounded-2xl cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-850 ${
                    selectedTabs.scoringIndividual 
                    ? "border-blue-600 bg-blue-50/20 dark:border-blue-500 dark:bg-blue-950/20" 
                    : "border-gray-205 bg-white dark:border-slate-800 dark:bg-slate-900"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <input 
                        type="checkbox"
                        checked={selectedTabs.scoringIndividual}
                        onChange={() => setSelectedTabs(p => ({ ...p, scoringIndividual: !p.scoringIndividual }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">tab Ghi Điểm (Cá Nhân)</span>
                        <span className="text-[10px] text-gray-400 block font-normal font-sans">Sổ ghi điểm chi tiết hồng tâm cá nhân ({paginatedScoringIndividualVisible.length} ảnh)</span>
                      </div>
                    </div>
                  </label>

                  {/* Option Leaderboard Individual */}
                  <label className={`flex items-center justify-between p-3 border-2 rounded-2xl cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-850 ${
                    selectedTabs.leaderboardIndividual 
                    ? "border-blue-600 bg-blue-50/20 dark:border-blue-500 dark:bg-blue-950/20" 
                    : "border-gray-205 bg-white dark:border-slate-800 dark:bg-slate-900"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <input 
                        type="checkbox"
                        checked={selectedTabs.leaderboardIndividual}
                        onChange={() => setSelectedTabs(p => ({ ...p, leaderboardIndividual: !p.leaderboardIndividual }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">tab Bảng Cá Nhân (Cá Nhân)</span>
                        <span className="text-[10px] text-gray-400 block font-normal font-sans">Bảng xếp hạng cá nhân ({paginatedLeaderboardIndividualVisible.length} ảnh)</span>
                      </div>
                    </div>
                  </label>

                  {/* Option Scoring Team */}
                  <label className={`flex items-center justify-between p-3 border-2 rounded-2xl cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-850 ${
                    selectedTabs.scoringTeam 
                    ? "border-blue-600 bg-blue-50/20 dark:border-blue-500 dark:bg-blue-950/20" 
                    : "border-gray-205 bg-white dark:border-slate-800 dark:bg-slate-900"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <input 
                        type="checkbox"
                        checked={selectedTabs.scoringTeam}
                        onChange={() => setSelectedTabs(p => ({ ...p, scoringTeam: !p.scoringTeam }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">tab Ghi Điểm Team (Đồng Đội)</span>
                        <span className="text-[10px] text-gray-400 block font-normal font-sans">Sổ ghi điểm chi tiết hồng tâm đồng đội ({paginatedScoringTeamVisible.length} ảnh)</span>
                      </div>
                    </div>
                  </label>

                  {/* Option Leaderboard Team */}
                  <label className={`flex items-center justify-between p-3 border-2 rounded-2xl cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-850 ${
                    selectedTabs.leaderboardTeam 
                    ? "border-blue-600 bg-blue-50/20 dark:border-blue-500 dark:bg-blue-950/20" 
                    : "border-gray-205 bg-white dark:border-slate-800 dark:bg-slate-900"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <input 
                        type="checkbox"
                        checked={selectedTabs.leaderboardTeam}
                        onChange={() => setSelectedTabs(p => ({ ...p, leaderboardTeam: !p.leaderboardTeam }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">tab Bảng Cá Nhân Team (Đồng Đội)</span>
                        <span className="text-[10px] text-gray-400 block font-normal font-sans">Bảng xếp hạng cá nhân của giải đồng đội ({paginatedLeaderboardTeamVisible.length} ảnh)</span>
                      </div>
                    </div>
                  </label>

                  {/* Option Team Leaderboard */}
                  <label className={`flex items-center justify-between p-3 border-2 rounded-2xl cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-850 ${
                    selectedTabs.teams 
                    ? "border-blue-600 bg-blue-50/20 dark:border-blue-500 dark:bg-blue-950/20" 
                    : "border-gray-205 bg-white dark:border-slate-800 dark:bg-slate-900"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <input 
                        type="checkbox"
                        checked={selectedTabs.teams}
                        onChange={() => setSelectedTabs(p => ({ ...p, teams: !p.teams }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">tab Bảng Đồng Đội Team (Đồng Đội)</span>
                        <span className="text-[10px] text-gray-400 block font-normal font-sans">Bảng xếp hạng đồng đội - Trụ Lại Cuối Cùng ({paginatedTeamsTeamVisible.length} ảnh)</span>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Format selection */}
              <div>
                <h3 className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider mb-2.5 flex items-center justify-between">
                  <span>2. Định dạng ảnh & Khổ khung hình</span>
                  {totalRenderedPages > 0 && (
                    <span className="text-xs font-extrabold text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full font-mono">
                      Tổng số: {totalRenderedPages} ảnh {aspectRatio === "9:16" ? "dọc" : "ngang"}
                    </span>
                  )}
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* PNG vs JPG format button */}
                  <div className="bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-2xl flex border border-gray-200 dark:border-slate-800 items-center justify-between gap-1 w-full">
                    <span className="text-xs text-slate-500 font-bold ml-1.5 shrink-0">Loại đuôi:</span>
                    <div className="flex bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg w-full max-w-[150px] shrink-0">
                      <button 
                        type="button"
                        onClick={() => setImageFormat("png")}
                        className={`flex-1 text-[11px] font-bold py-1 px-2 rounded-md transition-all ${
                          imageFormat === "png" 
                            ? "bg-white text-slate-900 shadow" 
                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                        }`}
                      >
                        PNG
                      </button>
                      <button 
                        type="button"
                        onClick={() => setImageFormat("jpg")}
                        className={`flex-1 text-[11px] font-bold py-1 px-2 rounded-md transition-all ${
                          imageFormat === "jpg" 
                            ? "bg-white text-slate-900 shadow" 
                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                        }`}
                      >
                        JPG
                      </button>
                    </div>
                  </div>

                  {/* Aspect Ratio choice (9:16 vs 16:9) */}
                  <div className="bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-2xl flex border border-gray-200 dark:border-slate-800 items-center justify-between gap-1 w-full">
                    <span className="text-xs text-slate-500 font-bold ml-1.5 shrink-0">Khổ ảnh:</span>
                    <div className="flex bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg w-full max-w-[180px] shrink-0">
                      <button 
                        type="button"
                        onClick={() => setAspectRatio("9:16")}
                        className={`flex-1 text-[11px] font-bold py-1 px-2 rounded-md transition-all ${
                          aspectRatio === "9:16" 
                            ? "bg-white text-slate-900 shadow" 
                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                        }`}
                      >
                        Dọc (9:16)
                      </button>
                      <button 
                        type="button"
                        onClick={() => setAspectRatio("16:9")}
                        className={`flex-1 text-[11px] font-bold py-1 px-2 rounded-md transition-all ${
                          aspectRatio === "16:9" 
                            ? "bg-white text-slate-900 shadow" 
                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                        }`}
                      >
                        Ngang (16:9)
                      </button>
                    </div>
                  </div>

                  {/* Autodetect Indicator block for Platform */}
                  <div className="bg-blue-50/40 dark:bg-slate-950/20 p-3 rounded-2xl border border-blue-100/50 dark:border-slate-800 flex items-center gap-2.5">
                    {/Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent) ? (
                      <>
                        <Smartphone className="w-5 h-5 text-indigo-500 shrink-0" />
                        <div className="text-[10.5px] leading-tight text-indigo-800 dark:text-indigo-400 font-semibold">
                          Chúng tôi phát hiện điện thoại. Điểm xuất sẽ được tải từng ảnh trực tiếp về thư viện ảnh của bạn!
                        </div>
                      </>
                    ) : (
                      <>
                        <Laptop className="w-5 h-5 text-indigo-500 shrink-0" />
                        <div className="text-[10.5px] leading-tight text-indigo-800 dark:text-indigo-400 font-semibold">
                          Chúng tôi phát hiện máy tính. Các ảnh sẽ được nén gọn trong 1 thư mục dạng *.ZIP đẹp mắt để lưu giữ!
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress Panel when downloading */}
              {isExporting && (
                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border-2 border-indigo-200/50 dark:border-indigo-900/40 rounded-3xl p-5 mb-2 relative overflow-hidden flex flex-col gap-3 animate-pulse">
                  <div className="flex justify-between items-center text-xs text-indigo-950 dark:text-indigo-250 font-bold">
                    <span className="flex items-center gap-1.5 font-sans uppercase">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                      {progressText}
                    </span>
                    <span className="font-mono">{exportProgress}%</span>
                  </div>
                  {/* Progress bar line */}
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full transition-all duration-300"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Beautiful Instructions Box for User regarding layout */}
              <div className="bg-slate-50 dark:bg-slate-950/20 p-4 border border-gray-200 dark:border-slate-800 rounded-2xl flex gap-3.5 text-xs text-slate-500 font-medium">
                <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-bounce" />
                <div>
                  <span className="text-slate-800 dark:text-slate-200 font-bold block mb-1">
                    Công nghệ phân mảnh 9:16 độc đáo
                  </span>
                  Thiết kế được chia dòng tự động theo quy chuẩn của Liên đoàn để các trang thông tin khi xuất ra không bị cắt đôi chữ, giữ nguyên logo, tiêu đề và số thứ tự trang &quot;Trang X trên Y&quot; ở mọi tấm hình!
                </div>
              </div>
            </>
          )}

        </div>

        {/* Footer controls section of the Modal */}
        <div className="p-6 bg-slate-50 dark:bg-slate-950/40 border-t border-gray-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-400 font-semibold">
            Tạo bởi công cụ tự động vô địch bắn ná • #HiepNAT
          </div>
          <div className="flex gap-2.5 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none uppercase font-black text-xs px-5 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 transition-all cursor-pointer text-center"
              disabled={isExporting}
            >
              Hủy
            </button>
            <button
              onClick={handleExport}
              disabled={athletes.length === 0 || totalRenderedPages === 0 || isExporting}
              className="flex-1 sm:flex-none uppercase font-black text-xs px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all disabled:opacity-55 cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-indigo-200 dark:shadow-none hover:scale-[1.01] active:scale-95"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  Đang xuất...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 shrink-0" />
                  XUẤT ẢNH
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* ========================================== */}
      {/* HIDDEN OFF-SCREEN GRAPHICS ENGINE STAGE  */}
      {/* ========================================== */}
      <div 
        ref={exportContainerRef}
        style={{ position: "absolute", left: "-9999px", top: "-9999px" }} 
        className="flex flex-col bg-slate-50 p-2 select-none pointer-events-none"
      >
        {/* Render each actual exportable page */}
        
        {/* PAGE type: DASHBOARD */}
        {selectedTabs.dashboard && athletes.length > 0 && (() => {
          // Extract top 3 individual athletes safely - ALWAYS from Individual Leaderboard
          const bestIndividual_1 = leaderboardDataIndividual[0] || null;
          const bestIndividual_2 = leaderboardDataIndividual[1] || null;
          const bestIndividual_3 = leaderboardDataIndividual[2] || null;

          // Extract top 3 teams safely - ALWAYS from Team Environment (Trụ Lại Cuối Cùng)
          const bestTeam_1 = teamsDataTeam[0] || null;
          const bestTeam_2 = teamsDataTeam[1] || null;
          const bestTeam_3 = teamsDataTeam[2] || null;

          // Fetch top scorers details for team podium
          const shooter1 = bestTeam_1?.members[0] ? athletes.find(a => a.id === bestTeam_1.members[0].id) : null;
          const shooter2 = bestTeam_2?.members[0] ? athletes.find(a => a.id === bestTeam_2.members[0].id) : null;
          const shooter3 = bestTeam_3?.members[0] ? athletes.find(a => a.id === bestTeam_3.members[0].id) : null;

          // Calculate registered clubs
          const registeredClubs = Array.from(new Set(athletes.map(a => a.team?.trim()).filter(Boolean)));
          const registeredClubsCount = registeredClubs.length || 0;

          // Declare individual podium block as a reusable JSX element
          const individualPodiumNode = (
            <div className="bg-white border border-slate-200 p-4 rounded-3xl flex flex-col justify-between h-full relative shadow-sm">
              <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 shrink-0">
                <Trophy className="w-4 h-4 text-amber-500 animate-pulse" />
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Bảng Vàng Cá Nhân</h3>
                  <span className="text-[8px] text-slate-500 block font-semibold leading-none mt-0.5">Top 3 Xạ Thủ sở hữu phong độ ấn tượng</span>
                </div>
              </div>

              <div className="flex items-end justify-center pt-8 pb-1 px-1 bg-gradient-to-b from-transparent to-slate-50 rounded-2xl flex-1 mt-1">
                {/* 2nd Place */}
                {bestIndividual_2 && (
                  <div className="flex flex-col items-center flex-1 max-w-[105px] z-10 animate-fade-in">
                    <div className="text-center mb-1 flex flex-col items-center w-full min-h-[90px] justify-end">
                      <div className="relative">
                        {getAvatar(bestIndividual_2.name, bestIndividual_2.gender, bestIndividual_2.avatarUrl, "w-10 h-10 border-2 border-slate-305 bg-white shadow-sm")}
                        <div className="absolute -top-1 -right-1 bg-slate-200 text-slate-800 rounded-full w-4.5 h-4.5 flex items-center justify-center border border-white text-[9px] font-black font-sans shadow-sm">
                          2
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-slate-700 block truncate leading-tight mt-1 w-full text-center">{bestIndividual_2.name}</span>
                      <span className="text-[8px] text-slate-450 block truncate leading-none w-full text-center mt-0.5">{bestIndividual_2.team || "Tự Do"}</span>
                      <span className="font-mono text-[10px] font-black text-indigo-600 block mt-0.5">{bestIndividual_2.totalScore} đ</span>
                    </div>
                    <div className="w-full bg-gradient-to-t from-slate-200 via-slate-100 to-slate-50 border-t-2 border-slate-300 h-14 rounded-t-xl shadow flex items-center justify-center relative">
                      <span className="font-black text-2xl font-mono text-slate-300/40">2</span>
                    </div>
                  </div>
                )}

                {/* 1st Place */}
                {bestIndividual_1 && (
                  <div className="flex flex-col items-center flex-1 max-w-[125px] z-20 -mx-1">
                    <div className="text-center mb-1 flex flex-col items-center w-full min-h-[105px] justify-end">
                      <div className="relative">
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-amber-500 drop-shadow-sm scale-90">👑</div>
                        {getAvatar(bestIndividual_1.name, bestIndividual_1.gender, bestIndividual_1.avatarUrl, "w-12 h-12 border-2 border-amber-400 bg-white shadow-md")}
                        <div className="absolute -top-1 -right-1 bg-amber-400 text-amber-950 rounded-full w-5 h-5 flex items-center justify-center border border-white text-[10px] font-black font-sans shadow-md">
                          1
                        </div>
                      </div>
                      <span className="text-[11px] font-black text-slate-900 block truncate leading-tight mt-1.5 w-full text-center">{bestIndividual_1.name}</span>
                      <span className="text-[8px] text-slate-500 block truncate leading-none w-full text-center mt-0.5">{bestIndividual_1.team || "Tự Do"}</span>
                      <span className="font-mono text-[11px] font-black text-amber-600 block mt-0.5">{bestIndividual_1.totalScore} đ</span>
                    </div>
                    <div className="w-full bg-gradient-to-t from-amber-400 via-amber-300 to-amber-100 border-t-2 border-amber-400 h-[76px] rounded-t-xl shadow-md flex items-center justify-center relative">
                      <span className="font-black text-3xl font-mono text-amber-500/25">1</span>
                    </div>
                  </div>
                )}

                {/* 3rd Place */}
                {bestIndividual_3 && (
                  <div className="flex flex-col items-center flex-1 max-w-[105px] z-10">
                    <div className="text-center mb-1 flex flex-col items-center w-full min-h-[90px] justify-end">
                      <div className="relative">
                        {getAvatar(bestIndividual_3.name, bestIndividual_3.gender, bestIndividual_3.avatarUrl, "w-9 h-9 border-2 border-orange-300 bg-white shadow-sm")}
                        <div className="absolute -top-1 -right-1 bg-orange-200 text-orange-950 rounded-full w-4.5 h-4.5 flex items-center justify-center border border-white text-[9px] font-black font-sans shadow-sm">
                          3
                        </div>
                      </div>
                      <span className="text-[9.5px] font-black text-slate-750 block truncate leading-tight mt-1 w-full text-center">{bestIndividual_3.name}</span>
                      <span className="text-[8px] text-slate-450 block truncate leading-none w-full text-center mt-0.5">{bestIndividual_3.team || "Tự Do"}</span>
                      <span className="font-mono text-[10px] font-black text-indigo-550 block mt-0.5">{bestIndividual_3.totalScore} đ</span>
                    </div>
                    <div className="w-full bg-gradient-to-t from-orange-200 via-orange-100 to-orange-50/50 border-t-2 border-orange-300 h-10 rounded-t-xl shadow flex items-center justify-center relative">
                      <span className="font-black text-xl font-mono text-orange-400/25">3</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );

          // Declare team podium block as a reusable JSX element
          const teamPodiumNode = (
            <div className="bg-white border border-slate-200 p-4 rounded-3xl flex flex-col justify-between h-full relative shadow-sm">
              <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 shrink-0">
                <Shield className="w-4 h-4 text-indigo-505" />
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Bảng Vàng Đồng Đội</h3>
                  <span className="text-[8px] text-slate-500 block font-semibold leading-none mt-0.5">Xếp hạng bệ vinh quang các CLB</span>
                </div>
              </div>

              <div className="flex items-end justify-center pt-8 pb-1 px-1 bg-gradient-to-b from-transparent to-slate-50 rounded-2xl flex-1 mt-1">
                {/* 2nd Place Team */}
                {bestTeam_2 && (
                  <div className="flex flex-col items-center flex-1 max-w-[105px] z-10">
                    <div className="text-center mb-1 flex flex-col items-center w-full min-h-[90px] justify-end">
                      <div className="relative">
                        {getAvatar(shooter2 ? shooter2.name : "", shooter2 ? shooter2.gender : undefined, shooter2 ? shooter2.avatarUrl : undefined, "w-10 h-10 border-2 border-slate-300 bg-white shadow-sm")}
                        <div className="absolute -top-1 -right-1 bg-slate-200 text-slate-800 rounded-full w-4.5 h-4.5 flex items-center justify-center border border-white text-[9px] font-black font-sans shadow-sm">
                          2
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-slate-700 block truncate leading-tight mt-1 w-full text-center">{bestTeam_2.teamName}</span>
                      <span className="text-[8px] text-slate-450 block truncate leading-none w-full text-center mt-0.5">Chủ lực: {shooter2 ? shooter2.name.split(" ").slice(-1)[0] : "Chưa rõ"}</span>
                      <span className="font-mono text-[10px] font-black text-indigo-600 block mt-0.5">{bestTeam_2.totalScore} đ</span>
                      <span className="text-[8.5px] font-bold text-slate-500 block leading-none mt-1">Trụ: {bestTeam_2.survivalVal === actualTeamDistances.length ? "Chung cuộc" : `Vòng ${bestTeam_2.survivalVal + 1}`}</span>
                    </div>
                    <div className="w-full bg-gradient-to-t from-slate-200 via-slate-100 to-slate-50 border-t-2 border-slate-300 h-14 rounded-t-xl shadow flex items-center justify-center relative">
                      <span className="font-black text-2xl font-mono text-slate-300/40">2</span>
                    </div>
                  </div>
                )}

                {/* 1st Place Team */}
                {bestTeam_1 && (
                  <div className="flex flex-col items-center flex-1 max-w-[125px] z-20 -mx-1">
                    <div className="text-center mb-1 flex flex-col items-center w-full min-h-[105px] justify-end">
                      <div className="relative">
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-indigo-500 drop-shadow-sm scale-90">🏆</div>
                        {getAvatar(shooter1 ? shooter1.name : "", shooter1 ? shooter1.gender : undefined, shooter1 ? shooter1.avatarUrl : undefined, "w-12 h-12 border-2 border-amber-400 bg-white shadow-md")}
                        <div className="absolute -top-1 -right-1 bg-amber-400 text-amber-950 rounded-full w-5 h-5 flex items-center justify-center border border-white text-[10px] font-black font-sans shadow-md">
                          1
                        </div>
                      </div>
                      <span className="text-[11px] font-black text-slate-900 block truncate leading-tight mt-1.5 w-full text-center">{bestTeam_1.teamName}</span>
                      <span className="text-[8px] text-indigo-600 block truncate leading-none w-full text-center mt-0.5">Chủ lực: {shooter1 ? shooter1.name.split(" ").slice(-1)[0] : "Chưa rõ"}</span>
                      <span className="font-mono text-[11px] font-black text-amber-600 block mt-0.5">{bestTeam_1.totalScore} đ</span>
                      <span className="text-[9px] font-black text-indigo-650 block leading-none mt-1">Trụ: {bestTeam_1.survivalVal === actualTeamDistances.length ? "Chung cuộc" : `Vòng ${bestTeam_1.survivalVal + 1}`}</span>
                    </div>
                    <div className="w-full bg-gradient-to-t from-indigo-600 via-indigo-500 to-indigo-100 border-t-2 border-indigo-400 h-[76px] rounded-t-xl shadow-md flex items-center justify-center relative">
                      <span className="font-black text-3xl font-mono text-indigo-500/20">1</span>
                    </div>
                  </div>
                )}

                {/* 3rd Place Team */}
                {bestTeam_3 && (
                  <div className="flex flex-col items-center flex-1 max-w-[105px] z-10">
                    <div className="text-center mb-1 flex flex-col items-center w-full min-h-[90px] justify-end">
                      <div className="relative">
                        {getAvatar(shooter3 ? shooter3.name : "", shooter3 ? shooter3.gender : undefined, shooter3 ? shooter3.avatarUrl : undefined, "w-9 h-9 border-2 border-orange-300 bg-white shadow-sm")}
                        <div className="absolute -top-1 -right-1 bg-orange-200 text-orange-955 rounded-full w-4.5 h-4.5 flex items-center justify-center border border-white text-[9px] font-black font-sans shadow-sm">
                          3
                        </div>
                      </div>
                      <span className="text-[9.5px] font-black text-slate-700 block truncate leading-tight mt-1 w-full text-center">{bestTeam_3.teamName}</span>
                      <span className="text-[8px] text-slate-500 block truncate leading-none w-full text-center mt-0.5">Chủ lực: {shooter3 ? shooter3.name.split(" ").slice(-1)[0] : "Chưa rõ"}</span>
                      <span className="font-mono text-[10px] font-black text-indigo-550 block mt-0.5">{bestTeam_3.totalScore} đ</span>
                      <span className="text-[8.5px] font-bold text-slate-500 block leading-none mt-1">Trụ: {bestTeam_3.survivalVal === actualTeamDistances.length ? "Chung cuộc" : `Vòng ${bestTeam_3.survivalVal + 1}`}</span>
                    </div>
                    <div className="w-full bg-gradient-to-t from-orange-200 via-orange-100 to-orange-50/50 border-t-2 border-orange-300 h-10 rounded-t-xl shadow flex items-center justify-center relative">
                      <span className="font-black text-xl font-mono text-orange-400/25">3</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );

          // Declare Top 10 Athletes standings block as a reusable JSX element (strictly without avatars)
          const top10StandingsNode = (
            <div className="bg-white border border-slate-200 rounded-3xl px-5 py-4 h-full flex flex-col justify-start overflow-hidden shadow-sm">
              <h3 className="text-[11px] font-black uppercase text-indigo-650 tracking-wider flex items-center gap-1.5 mb-2.5 shrink-0">
                <Star className="w-4 h-4 fill-amber-400 text-amber-500 stroke-none" />
                Top 10 Tổng Hợp Đấu Thủ Lực Vương
              </h3>
              
              <div className="flex-1 overflow-hidden border border-slate-200 rounded-xl bg-white shadow-inner">
                <table className="w-full text-left text-[11px] border-collapse leading-none">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-extrabold uppercase text-[9px] tracking-wider">
                      <th className="py-2.5 px-4 text-center w-12 text-[9px]">Hạng</th>
                      <th className="py-2.5 px-3 text-[9px]">Họ và Tên Tuyển Thủ</th>
                      <th className="py-2.5 px-3 text-[9px]">Câu Lạc Bộ</th>
                      <th className="py-2.5 px-3 text-center w-16 text-[9px]">Acc %</th>
                      <th className="py-2.5 px-4 text-right w-20 text-[9px]">Điểm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leaderboardDataIndividual.slice(0, 10).map((ath, idx) => {
                      const darkRow = idx % 2 === 1 ? "bg-slate-50/40" : "";
                      return (
                        <tr key={`exp-top10-${ath.id || "ath"}-${idx}`} className={`hover:bg-slate-50/80 ${darkRow}`}>
                          <td className="py-2 px-4 text-center font-bold">
                            <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[9.5px] font-mono leading-none ${
                              idx === 0 ? "bg-amber-400 text-slate-900 font-black px-1" :
                              idx === 1 ? "bg-slate-200 text-slate-700 font-black px-1" :
                              idx === 2 ? "bg-orange-200 text-orange-900 font-extrabold px-1" :
                              "text-slate-500 bg-slate-100"
                            }`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-extrabold text-slate-905 truncate max-w-[150px]">{ath.name}</td>
                          <td className="py-2 px-3 text-slate-550 font-bold truncate max-w-[120px]">{ath.team || "Tự Do"}</td>
                          <td className="py-2 px-3 text-center text-emerald-600 font-mono font-bold">{ath.accuracy.toFixed(1)}%</td>
                          <td className="py-2 px-4 text-right text-indigo-650 font-mono font-black">{ath.totalScore}đ</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );

          return (
            <div 
              id="export-dashboard-0"
              data-export-page="dashboard"
              className={`${aspectRatio === "16:9" ? "w-[1422px] h-[800px]" : "w-[800px] h-[1422px]"} bg-slate-50 text-slate-900 flex flex-col justify-between overflow-hidden relative shadow-2xl shrink-0`}
              style={{ width: aspectRatio === "16:9" ? "1422px" : "800px", height: aspectRatio === "16:9" ? "800px" : "1422px" }}
            >
              {/* Clean bright mesh design */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.06),transparent_60%)] z-0" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.04),transparent_50%5)] z-0" />

              {/* Poster Header */}
              <div className="h-[140px] bg-gradient-to-r from-indigo-900 via-indigo-950 to-indigo-900 border-b border-indigo-200 px-8 flex items-center justify-between shrink-0 relative z-10 shadow-sm text-white">
                <div className="flex items-center gap-4">
                  <div className="bg-white/10 p-1.5 rounded-2xl border border-white/20 shrink-0 shadow-sm">
                    <VSCLogo size={50} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] uppercase font-serif font-black tracking-widest bg-amber-450 text-slate-950 px-2 rounded-full leading-none py-0.5">
                        VSC OFFICIAL
                      </span>
                      <span className="text-[9.5px] uppercase font-mono tracking-widest text-indigo-300 font-black leading-none">
                        BENTO REPORT
                      </span>
                    </div>
                    <h1 className="text-sm font-black text-white uppercase tracking-tight leading-tight mt-1 truncate max-w-[420px]">
                      {matchName}
                    </h1>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-amber-300 uppercase font-mono tracking-widest block">
                    BÁO CÁO CHUNG
                  </span>
                  <span className="text-[10px] text-indigo-150 font-bold block mt-0.5 font-sans">
                    {new Date().toLocaleDateString("vi-VN")} {new Date().toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Poster Main Body content inside */}
              <div className="flex-1 p-8 flex flex-col gap-4 relative z-10 justify-start overflow-hidden">
                
                {/* 1. Bento Grid (4 metrics) */}
                <div className="grid grid-cols-4 gap-3.5 shrink-0">
                  {/* Metric 1: Sĩ số đấu thủ */}
                  <div className="bg-white border border-slate-200 shadow-sm p-3 rounded-2xl flex flex-col justify-between h-[80px]">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-[8.5px] font-black uppercase tracking-wider">Sĩ Số Đấu Thủ</span>
                      <Users className="w-3.5 h-3.5 text-rose-500" />
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-black font-mono text-slate-900">{athletes.length}</span>
                      <span className="text-[10px] text-slate-500 font-bold">VĐV</span>
                    </div>
                  </div>

                  {/* Metric 2: Cơ sở CLB */}
                  <div className="bg-white border border-slate-200 shadow-sm p-3 rounded-2xl flex flex-col justify-between h-[80px]">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-[8.5px] font-black uppercase tracking-wider">Cơ Số CLB</span>
                      <Shield className="w-3.5 h-3.5 text-indigo-500" />
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-black font-mono text-slate-900">{registeredClubsCount}</span>
                      <span className="text-[10px] text-slate-500 font-bold">CLB</span>
                    </div>
                  </div>

                  {/* Metric 3: Độ chính xác */}
                  <div className="bg-white border border-slate-200 shadow-sm p-3 rounded-2xl flex flex-col justify-between h-[80px]">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-[8.5px] font-black uppercase tracking-wider">Độ Chính Xác</span>
                      <Target className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <div className="flex items-baseline gap-0.5 mt-1">
                      <span className="text-lg font-black font-mono text-emerald-600">{dashboardHighlights.avgAccuracy.toFixed(1)}%</span>
                      <span className="text-[9px] text-slate-505 font-bold">Acc</span>
                    </div>
                  </div>

                  {/* Metric 4: Kỷ lục điểm */}
                  <div className="bg-white border border-slate-200 shadow-sm p-3 rounded-2xl flex flex-col justify-between h-[80px] min-w-0">
                    <div className="flex items-center justify-between text-slate-505">
                      <span className="text-[8.5px] font-black uppercase tracking-wider">Kỷ Lục Điểm</span>
                      <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <div className="flex flex-col mt-0.5 min-w-0">
                      <div className="flex items-baseline gap-0.5 leading-none">
                        <span className="text-lg font-black font-mono text-amber-600">{dashboardHighlights.bestScoreValue}</span>
                        <span className="text-[8px] text-amber-600 font-black uppercase font-sans">đ</span>
                      </div>
                      <span className="text-[8.5px] text-slate-600 font-extrabold block truncate leading-none mt-1">{dashboardHighlights.bestScoreName}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Main content row: Responsive grid layout based on aspect ratio */}
                {aspectRatio === "16:9" ? (
                  /* 16:9 HORIZONTAL LAYOUT: 3 Columns side-by-side */
                  <div className="grid grid-cols-12 gap-4 h-[440px] shrink-0 mt-1">
                    <div className="col-span-4 h-full">
                      {individualPodiumNode}
                    </div>
                    <div className="col-span-4 h-full">
                      {teamPodiumNode}
                    </div>
                    <div className="col-span-4 h-full">
                      {top10StandingsNode}
                    </div>
                  </div>
                ) : (
                  /* 9:16 VERTICAL LAYOUT: Sequentially stacked */
                  <>
                    {/* Podiums Side-By-Side */}
                    <div className="grid grid-cols-2 gap-4 h-[350px] shrink-0 mt-1">
                      {individualPodiumNode}
                      {teamPodiumNode}
                    </div>

                    {/* Top 10 Athletes Standings */}
                    {top10StandingsNode}
                  </>
                )}

              </div>

              {/* Poster Footer */}
              <div className="h-[100px] bg-indigo-950 border-t border-indigo-900 px-8 flex items-center justify-between shrink-0 relative z-10 text-indigo-200">
                <span className="text-[11px] text-indigo-200 font-bold max-w-[480px]">
                  Ứng dụng tính điểm Ná Slingshot chính thức • Kênh truyền thông: vsc.vietnamslingshot
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-305 font-black">
                    Trang 1 / 1
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* PAGE type: LEADERBOARD INDIVIDUAL */}
        {selectedTabs.leaderboardIndividual && athletes.length > 0 && paginatedLeaderboardIndividualVisible.map((chunk, chunkIdx) => {
          const totalPages = paginatedLeaderboardIndividualVisible.length;
          return (
            <div 
              key={`leaderboard-ind-${chunkIdx}`}
              id={`export-leaderboard-individual-${chunkIdx + 1}`}
              data-export-page="leaderboard-individual"
              className={`${aspectRatio === "16:9" ? "w-[1422px] h-[800px]" : "w-[800px] h-[1422px]"} bg-slate-50 text-slate-900 flex flex-col justify-between overflow-hidden relative shadow-2xl shrink-0`}
              style={{ width: aspectRatio === "16:9" ? "1422px" : "800px", height: aspectRatio === "16:9" ? "800px" : "1422px" }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.06),transparent_60%)] z-0" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.04),transparent_50%)] z-0" />

              {/* Poster Header */}
              <div className="h-[140px] bg-gradient-to-r from-indigo-900 via-indigo-950 to-indigo-900 border-b border-indigo-200 px-8 flex items-center justify-between shrink-0 relative z-10 shadow-sm text-white">
                <div className="flex items-center gap-4">
                  <div className="bg-white/10 p-1.5 rounded-2xl border border-white/20 shrink-0 shadow-sm">
                    <VSCLogo size={50} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] uppercase font-serif font-black tracking-widest bg-amber-400 text-slate-950 px-2 rounded-full leading-none py-0.5">
                        VSC OFFICIAL
                      </span>
                      <span className="text-[9.5px] uppercase font-mono tracking-widest text-indigo-305 font-black leading-none animate-pulse">
                        INDIVIDUAL LEADERBOARD
                      </span>
                    </div>
                    <h1 className="text-sm font-black text-white uppercase tracking-tight leading-tight mt-1 truncate max-w-[420px]">
                      {matchName}
                    </h1>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-amber-300 uppercase font-mono tracking-widest block">
                    BẢNG CÁ NHÂN (CÁ NHÂN)
                  </span>
                  <span className="text-[10px] text-indigo-200 font-bold block mt-0.5 font-sans">
                    {new Date().toLocaleDateString("vi-VN")} {new Date().toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Poster Main Body content inside */}
              <div className="flex-1 p-8 flex flex-col gap-4 relative z-10 justify-start overflow-hidden">
                
                {/* Banner title / subheaders */}
                <div className="text-center bg-indigo-50 border border-indigo-100 p-3 rounded-2xl shrink-0">
                  <h3 className="text-xs font-black uppercase text-indigo-900 tracking-wider">
                    {`Bảng Xếp Hạng Cá Nhân Chung Cuộc - Trang ${chunkIdx + 1}`}
                  </h3>
                </div>

                {/* Main Table */}
                <div className="flex-1 overflow-hidden border border-slate-200 rounded-3xl bg-white shadow-sm flex flex-col justify-start">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-550 font-bold uppercase text-[9px] tracking-wider border-b border-slate-205 shrink-0 select-none">
                      <tr>
                        <th className={`${aspectRatio === "16:9" ? "py-2.5" : "py-4"} px-4 text-center w-14 font-extrabold`}>Hạng</th>
                        <th className={`${aspectRatio === "16:9" ? "py-2.5" : "py-4"} px-3 font-extrabold`}>Họ và Tên VĐV</th>
                        <th className={`${aspectRatio === "16:9" ? "py-2.5" : "py-4"} px-3 font-extrabold`}>Câu Lạc Bộ / Đội</th>
                        <th className={`${aspectRatio === "16:9" ? "py-2.5" : "py-4"} px-3 text-center w-24 font-extrabold`}>Acc %</th>
                        <th className={`${aspectRatio === "16:9" ? "py-2.5" : "py-4"} px-4 text-right w-24 font-extrabold`}>Tổng Điểm</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {chunk.map((ath, idx) => {
                        const globalRank = leaderboardDataIndividual.findIndex(x => x.id === ath.id) + 1;
                        let rankBgClass = "bg-slate-100 text-slate-550 border-slate-200";
                        if (globalRank === 1) rankBgClass = "bg-amber-400 text-slate-950 border-amber-400 font-black shadow-sm";
                        else if (globalRank === 2) rankBgClass = "bg-slate-200 text-slate-805 border-slate-300 font-black shadow-sm";
                        else if (globalRank === 3) rankBgClass = "bg-orange-200 text-orange-950 border-orange-355 font-black shadow-sm";

                        return (
                          <tr key={`exp-chunk-ind-${ath.id || "ath"}-${idx}`} className="hover:bg-slate-50">
                            <td className={`${aspectRatio === "16:9" ? "py-2.5" : "py-4"} px-4 text-center shrink-0`}>
                              <span className={`w-7 h-7 rounded-xl border flex items-center justify-center mx-auto text-xs font-mono font-black ${rankBgClass}`}>
                                {globalRank}
                              </span>
                            </td>

                            <td className={`${aspectRatio === "16:9" ? "py-2.5" : "py-4"} px-3`}>
                              <div className="flex items-center gap-2.5 min-w-0">
                                {getAvatar(ath.name, ath.gender, ath.avatarUrl)}
                                <div className="min-w-0">
                                  <span className="text-xs font-bold text-slate-900 block truncate leading-tight">{ath.name}</span>
                                  <span className="text-[10px] text-slate-450 block tracking-wider font-mono uppercase mt-0.5 font-semibold">ID: {ath.id}</span>
                                </div>
                              </div>
                            </td>

                            <td className={`${aspectRatio === "16:9" ? "py-2.5" : "py-4"} px-3 text-slate-500 font-semibold truncate max-w-[140px]`}>
                              {ath.team || "VĐV Tự Do"}
                            </td>

                            <td className={`${aspectRatio === "16:9" ? "py-2.5" : "py-4"} px-3 text-center text-emerald-600 font-bold font-mono`}>
                              {ath.accuracy.toFixed(1)}% Acc
                            </td>

                            <td className={`${aspectRatio === "16:9" ? "py-2.5" : "py-4"} px-4 text-right`}>
                              <div className="bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl inline-block shadow-sm">
                                <span className="text-xs font-black font-mono text-amber-600 leading-none">{ath.totalScore}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              </div>

              {/* Poster Footer */}
              <div className="h-[100px] bg-indigo-950 border-t border-indigo-900 px-8 flex items-center justify-between shrink-0 relative z-10 text-indigo-200">
                <span className="text-[11px] text-indigo-200 font-bold max-w-[480px]">
                  Ứng dụng tính điểm Ná Slingshot chính thức • Kênh truyền thông: vsc.vietnamslingshot
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-305 font-black">
                    Trang {chunkIdx + 1} / {totalPages}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* PAGE type: LEADERBOARD TEAM */}
        {selectedTabs.leaderboardTeam && activeAthletesTeam.length > 0 && paginatedLeaderboardTeamVisible.map((chunk, chunkIdx) => {
          const totalPages = paginatedLeaderboardTeamVisible.length;
          return (
            <div 
              key={`leaderboard-team-${chunkIdx}`}
              id={`export-leaderboard-team-${chunkIdx + 1}`}
              data-export-page="leaderboard-team"
              className={`${aspectRatio === "16:9" ? "w-[1422px] h-[800px]" : "w-[800px] h-[1422px]"} bg-slate-50 text-slate-900 flex flex-col justify-between overflow-hidden relative shadow-2xl shrink-0`}
              style={{ width: aspectRatio === "16:9" ? "1422px" : "800px", height: aspectRatio === "16:9" ? "800px" : "1422px" }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.06),transparent_60%)] z-0" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.04),transparent_50%)] z-0" />

              {/* Poster Header */}
              <div className="h-[140px] bg-gradient-to-r from-indigo-900 via-indigo-950 to-indigo-900 border-b border-indigo-200 px-8 flex items-center justify-between shrink-0 relative z-10 shadow-sm text-white">
                <div className="flex items-center gap-4">
                  <div className="bg-white/10 p-1.5 rounded-2xl border border-white/20 shrink-0 shadow-sm">
                    <VSCLogo size={50} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] uppercase font-serif font-black tracking-widest bg-amber-400 text-slate-950 px-2 rounded-full leading-none py-0.5">
                        VSC OFFICIAL
                      </span>
                      <span className="text-[9.5px] uppercase font-mono tracking-widest text-indigo-305 font-black leading-none animate-pulse">
                        MEMBER LEADERBOARD
                      </span>
                    </div>
                    <h1 className="text-sm font-black text-white uppercase tracking-tight leading-tight mt-1 truncate max-w-[420px]">
                      {matchName}
                    </h1>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-amber-300 uppercase font-mono tracking-widest block">
                    BẢNG CÁ NHÂN TEAM (ĐỒNG ĐỘI)
                  </span>
                  <span className="text-[10px] text-indigo-200 font-bold block mt-0.5 font-sans">
                    {new Date().toLocaleDateString("vi-VN")} {new Date().toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Poster Main Body content inside */}
              <div className="flex-1 p-8 flex flex-col gap-4 relative z-10 justify-start overflow-hidden">
                
                {/* Banner title / subheaders */}
                <div className="text-center bg-indigo-50 border border-indigo-100 p-3 rounded-2xl shrink-0">
                  <h3 className="text-xs font-black uppercase text-indigo-900 tracking-wider">
                    {`Bảng Xếp Hạng Cá Nhân Team - Trang ${chunkIdx + 1}`}
                  </h3>
                </div>

                {/* Main Table */}
                <div className="flex-1 overflow-hidden border border-slate-200 rounded-3xl bg-white shadow-sm flex flex-col justify-start">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-550 font-bold uppercase text-[9px] tracking-wider border-b border-slate-205 shrink-0 select-none">
                      <tr>
                        <th className={`${aspectRatio === "16:9" ? "py-2.5" : "py-4"} px-4 text-center w-14 font-extrabold`}>Hạng</th>
                        <th className={`${aspectRatio === "16:9" ? "py-2.5" : "py-4"} px-3 font-extrabold`}>Họ và Tên VĐV</th>
                        <th className={`${aspectRatio === "16:9" ? "py-2.5" : "py-4"} px-3 font-extrabold`}>Câu Lạc Club / Đội</th>
                        <th className={`${aspectRatio === "16:9" ? "py-2.5" : "py-4"} px-3 text-center w-24 font-extrabold`}>Acc %</th>
                        <th className={`${aspectRatio === "16:9" ? "py-2.5" : "py-4"} px-4 text-right w-24 font-extrabold`}>Tổng Điểm</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {chunk.map((ath, idx) => {
                        const globalRank = leaderboardDataTeam.findIndex(x => x.id === ath.id) + 1;
                        let rankBgClass = "bg-slate-100 text-slate-550 border-slate-200";
                        if (globalRank === 1) rankBgClass = "bg-amber-400 text-slate-950 border-amber-400 font-black shadow-sm";
                        else if (globalRank === 2) rankBgClass = "bg-slate-200 text-slate-805 border-slate-300 font-black shadow-sm";
                        else if (globalRank === 3) rankBgClass = "bg-orange-200 text-orange-950 border-orange-355 font-black shadow-sm";

                        return (
                          <tr key={`exp-chunk-team-${ath.id || "ath"}-${idx}`} className="hover:bg-slate-50">
                            <td className={`${aspectRatio === "16:9" ? "py-2.5" : "py-4"} px-4 text-center shrink-0`}>
                              <span className={`w-7 h-7 rounded-xl border flex items-center justify-center mx-auto text-xs font-mono font-black ${rankBgClass}`}>
                                {globalRank}
                              </span>
                            </td>

                            <td className={`${aspectRatio === "16:9" ? "py-2.5" : "py-4"} px-3`}>
                              <div className="flex items-center gap-2.5 min-w-0">
                                {getAvatar(ath.name, ath.gender, ath.avatarUrl)}
                                <div className="min-w-0">
                                  <span className="text-xs font-bold text-slate-900 block truncate leading-tight">{ath.name}</span>
                                  <span className="text-[10px] text-slate-450 block tracking-wider font-mono uppercase mt-0.5 font-semibold">ID: {ath.id}</span>
                                </div>
                              </div>
                            </td>

                            <td className={`${aspectRatio === "16:9" ? "py-2.5" : "py-4"} px-3 text-slate-500 font-semibold truncate max-w-[140px]`}>
                              {ath.team || "VĐV Tự Do"}
                            </td>

                            <td className={`${aspectRatio === "16:9" ? "py-2.5" : "py-4"} px-3 text-center text-emerald-600 font-bold font-mono`}>
                              {ath.accuracy.toFixed(1)}% Acc
                            </td>

                            <td className={`${aspectRatio === "16:9" ? "py-2.5" : "py-4"} px-4 text-right`}>
                              <div className="bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl inline-block shadow-sm">
                                <span className="text-xs font-black font-mono text-amber-600 leading-none">{ath.totalScore}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              </div>

              {/* Poster Footer */}
              <div className="h-[100px] bg-indigo-950 border-t border-indigo-900 px-8 flex items-center justify-between shrink-0 relative z-10 text-indigo-200">
                <span className="text-[11px] text-indigo-200 font-bold max-w-[480px]">
                  Ứng dụng tính điểm Ná Slingshot chính thức • Kênh truyền thông: vsc.vietnamslingshot
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-305 font-black">
                    Trang {chunkIdx + 1} / {totalPages}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* PAGE type: TEAM LEADERBOARD (UPDATED: Responsive structure for 9:16 and 16:9 layouts) */}
        {selectedTabs.teams && teamsDataTeam.length > 0 && paginatedTeamsTeamVisible.map((chunk, chunkIdx) => {
          const totalPages = paginatedTeamsTeamVisible.length;
          return (
            <div 
              key={`teams-${chunkIdx}`}
              id={`export-teams-${chunkIdx + 1}`}
              data-export-page="teams"
              className={`${aspectRatio === "16:9" ? "w-[1422px] h-[800px]" : "w-[800px] h-[1422px]"} bg-slate-50 text-slate-900 flex flex-col justify-between overflow-hidden relative shadow-2xl shrink-0`}
              style={{ width: aspectRatio === "16:9" ? "1422px" : "800px", height: aspectRatio === "16:9" ? "800px" : "1422px" }}
            >
              {/* Bright background decorations */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.06),transparent_60%)] z-0" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.04),transparent_50%)] z-0" />

              {/* Poster Header */}
              <div className="h-[140px] bg-gradient-to-r from-indigo-900 via-indigo-950 to-indigo-900 border-b border-indigo-200 px-8 flex items-center justify-between shrink-0 relative z-10 shadow-sm text-white">
                <div className="flex items-center gap-4">
                  <div className="bg-white/10 p-1.5 rounded-2xl border border-white/20 shrink-0 shadow-sm">
                    <VSCLogo size={50} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] uppercase font-serif font-black tracking-widest bg-amber-400 text-slate-950 px-2 rounded-full leading-none py-0.5">
                        VSC OFFICIAL
                      </span>
                      <span className="text-[9.5px] uppercase font-mono tracking-widest text-indigo-305 font-black leading-none">
                        CHAMPIONS
                      </span>
                    </div>
                    <h1 className="text-sm font-black text-white uppercase tracking-tight leading-tight mt-1 truncate max-w-[420px]">
                      {matchName}
                    </h1>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-amber-300 uppercase font-mono tracking-widest block">
                    BẢNG ĐỒNG ĐỘI TEAM
                  </span>
                  <span className="text-[10px] text-indigo-200 font-bold block mt-0.5 font-sans">
                    {new Date().toLocaleDateString("vi-VN")} {new Date().toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Poster Main Body content inside */}
              <div className="flex-1 p-8 flex flex-col gap-3.5 relative z-10 justify-start overflow-hidden">
                
                {/* Banner title */}
                <div className="text-center bg-indigo-50 border border-indigo-100 p-3 rounded-2xl shrink-0">
                  <h3 className="text-xs font-black uppercase text-indigo-900 tracking-wider">
                    {`Bảng Điểm Đồng Đội Team - Trang ${chunkIdx + 1}`}
                  </h3>
                </div>

                {/* Team cards listing (Layout fit optimized precisely for height compatibility) */}
                <div className="flex-1 flex flex-col gap-3.5 overflow-hidden py-1 justify-start">
                  {chunk.map((team) => {
                    const globalIdx = teamsDataTeam.findIndex(t => t.teamName === team.teamName) + 1;
                    
                    let medalAccent = "border-slate-200 bg-white";
                    let markerColor = "text-slate-500 bg-slate-100 border-slate-200";
                    if (globalIdx === 1) { medalAccent = "border-amber-450 bg-amber-50/20"; markerColor = "text-slate-950 bg-amber-400 border-amber-400 font-black shadow-sm"; }
                    else if (globalIdx === 2) { medalAccent = "border-slate-350 bg-slate-50/40"; markerColor = "text-slate-900 bg-slate-200 border-slate-300 font-black shadow-sm"; }
                    else if (globalIdx === 3) { medalAccent = "border-orange-300 bg-orange-50/10"; markerColor = "text-orange-950 bg-orange-200 border-orange-300 font-black shadow-sm"; }

                    return (
                      <div 
                        key={team.teamName}
                        className={`border p-3.5 rounded-2xl flex gap-4 relative overflow-hidden shadow-sm transition-all ${aspectRatio === "16:9" ? "h-[135px]" : "h-[165px]"} ${medalAccent}`}
                      >
                        {/* Ring background accent */}
                        <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -mr-12 -mt-12 animate-pulse" />

                        {/* LEFT PANEL: Team main metrics (40% width) */}
                        <div className="w-[40%] flex flex-col justify-between border-r border-slate-200 pr-4 shrink-0">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`text-[12px] font-black font-mono shrink-0 w-7 h-7 rounded-xl flex items-center justify-center border ${markerColor}`}>
                              #{globalIdx}
                            </span>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-black text-slate-800 truncate leading-none">{team.teamName}</h4>
                              <span className="text-[9px] text-slate-500 font-bold block mt-1.5 uppercase tracking-wide leading-none">
                                {team.memberCount} Tuyển Thủ
                              </span>
                            </div>
                          </div>
                          
                          <div className="text-left mt-2 leading-none shrink-0">
                            <span className="text-sm font-black text-indigo-600 font-mono block leading-none">
                              {team.totalScore} Điểm
                            </span>
                            <span className="text-[9.5px] font-black text-emerald-600 font-mono block mt-1 leading-none">
                              {team.averageAccuracy.toFixed(1)}% Acc
                            </span>
                            <span className="text-[9.5px] font-black text-indigo-500 font-mono block mt-1.5 leading-none">
                              Trụ: {team.survivalVal === actualTeamDistances.length ? "Chung cuộc" : `Vòng ${team.survivalVal + 1}`}
                            </span>
                          </div>
                        </div>

                        {/* RIGHT PANEL: Top 3 contributing performers with custom avatars (60% width) */}
                        <div className="w-[60%] flex flex-col justify-between gap-1 shrink-0 pl-1">
                          <span className="text-[9.5px] uppercase font-black text-slate-500 block tracking-wider leading-none mb-1 shrink-0">
                            Xạ thủ chủ lực đóng góp:
                          </span>
                          <div className="flex-1 flex flex-col justify-between py-0.5">
                            {team.members.slice(0, 3).map((member, memberIdx) => {
                              const athleteDetails = athletes.find(a => a.id === member.id);
                              return (
                                <div key={member.id} className="flex justify-between items-center text-xs text-slate-650">
                                  <span className="font-extrabold text-slate-700 truncate leading-tight block text-[11px] flex items-center gap-1.5 max-w-[130px]">
                                    {getAvatar(member.name, athleteDetails?.gender, athleteDetails?.avatarUrl, `${aspectRatio === "16:9" ? "w-5 h-5" : "w-6 h-6"} border border-slate-200 shrink-0`)}
                                    <span className="truncate block">{member.name}</span>
                                  </span>
                                  <div className="flex items-center gap-1.5 font-mono leading-none shrink-0 border-none">
                                    <span className="text-[8.5px] text-slate-450 font-semibold">{member.accuracy.toFixed(1)}%</span>
                                    <span className="font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded leading-none text-[10px] shadow-sm">
                                      {member.totalScore}đ
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>

              </div>

              {/* Poster Footer */}
              <div className="h-[100px] bg-indigo-950 border-t border-indigo-900 px-8 flex items-center justify-between shrink-0 relative z-10 text-indigo-200">
                <span className="text-[11px] text-indigo-200 font-bold max-w-[480px]">
                  Ứng dụng tính điểm Ná Slingshot chính thức • Kênh truyền thông: vsc.vietnamslingshot
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-300 font-black">
                    Trang {chunkIdx + 1} / {totalPages}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* PAGE type: SCORING BOARD INDIVIDUAL DETAILS */}
        {selectedTabs.scoringIndividual && athletes.length > 0 && paginatedScoringIndividualVisible.map((chunk, chunkIdx) => {
          const totalPages = paginatedScoringIndividualVisible.length;
          const effectiveShotsCount = effectiveShotsCountIndividual;
          const effectiveDirectMaxPoints = effectiveDirectMaxPointsIndividual;
          return (
            <div 
              key={`scoring-ind-${chunkIdx}`}
              id={`export-scoring-individual-${chunkIdx + 1}`}
              data-export-page="scoring-individual"
              className={`${aspectRatio === "16:9" ? "w-[1422px] h-[800px]" : "w-[800px] h-[1422px]"} bg-slate-50 text-slate-900 flex flex-col justify-between overflow-hidden relative shadow-2xl shrink-0`}
              style={{ width: aspectRatio === "16:9" ? "1422px" : "800px", height: aspectRatio === "16:9" ? "800px" : "1422px" }}
            >
              {/* Overlay graphics */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.06),transparent_60%)] z-0" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.04),transparent_50%15)] z-0" />

              {/* Poster Header */}
              <div className="h-[140px] bg-gradient-to-r from-indigo-900 via-indigo-950 to-indigo-900 border-b border-indigo-200 px-8 flex items-center justify-between shrink-0 relative z-10 shadow-sm text-white">
                <div className="flex items-center gap-4">
                  <div className="bg-white/10 p-1.5 rounded-2xl border border-white/20 shrink-0 shadow-sm">
                    <VSCLogo size={50} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] uppercase font-serif font-black tracking-widest bg-amber-450 text-slate-950 px-2 rounded-full leading-none py-0.5">
                        VSC OFFICIAL
                      </span>
                      <span className="text-[9.5px] uppercase font-mono tracking-widest text-indigo-305 font-black leading-none">
                        DETAILS REPORT
                      </span>
                    </div>
                    <h1 className="text-sm font-black text-white uppercase tracking-tight leading-tight mt-1 truncate max-w-[420px]">
                      {matchName}
                    </h1>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-amber-300 uppercase font-mono tracking-widest block">
                    {competitionMode === "team" ? "GHI ĐIỂM TEAM CHI TIẾT" : "GHI ĐIỂM CHI TIẾT"}
                  </span>
                  <span className="text-[10px] text-indigo-150 font-bold block mt-0.5 font-sans">
                    {new Date().toLocaleDateString("vi-VN")} {new Date().toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Poster Main Body content inside */}
              <div className="flex-1 p-8 flex flex-col gap-3.5 relative z-10 justify-start overflow-hidden">
                
                {/* Title */}
                <div className="text-center bg-indigo-50 border border-indigo-100 p-3 rounded-2xl shrink-0">
                  <h3 className="text-xs font-black uppercase text-indigo-900 tracking-wider font-sans">
                    {`Sổ Điểm Chi Tiết Cá Nhân - Trang ${chunkIdx + 1}`}
                  </h3>
                </div>

                {/* Athlete Detail Cards list (Dynamic card sizes. Vòng nào vđv không ghi nhận điểm thì không đưa vào) */}
                <div className={`flex-1 overflow-hidden py-1 ${aspectRatio === "16:9" ? "grid grid-cols-2 gap-4 auto-rows-max justify-start items-start" : "flex flex-col gap-3.5 justify-start"}`}>
                  {chunk.map((ath, idx) => {
                    // Pre-calc total score & hits
                    let totalScore = 0;
                    let totalHits = 0;
                    actualIndDistances.forEach((dist) => {
                      const hits = ath.scores?.[dist.id] || [];
                      const hCount = getLeaderboardHitCountIndividual(hits);
                      totalScore += hCount * dist.multiplier;
                      totalHits += hCount;
                    });

                    // Filter only active distances with recorded score
                    const activeDistances = actualIndDistances.filter((dist) => {
                      const hits = ath.scores?.[dist.id];
                      return hits && hits.length > 0 && hits.some(v => v !== null && v !== undefined);
                    });
                    
                    const renderDists = activeDistances.length > 0 ? activeDistances : (actualIndDistances.length > 0 ? [actualIndDistances[0]] : []);

                    let accuracy = 0;
                    if (indIsDirectMode && effectiveDirectMaxPoints !== undefined && effectiveDirectMaxPoints > 0) {
                      const totalPossiblePoints = effectiveDirectMaxPoints * renderDists.reduce((sum, d) => sum + d.multiplier, 0);
                      accuracy = totalPossiblePoints > 0 ? (totalScore / totalPossiblePoints) * 100 : 0;
                    } else {
                      const totalPossibleShots = renderDists.length * effectiveShotsCount;
                      accuracy = totalPossibleShots > 0 ? (totalHits / totalPossibleShots) * 100 : 0;
                    }

                    return (
                      <div 
                        key={`exp-sc-ind-${ath.id || "ath"}-${idx}`}
                        className="bg-white border border-slate-200 p-4 rounded-3xl flex flex-col gap-3 shrink-0 w-full justify-between relative overflow-hidden shadow-sm transition-all"
                      >
                        {/* Athlete header card */}
                        <div className="flex justify-between items-center shrink-0 border-b border-dashed border-slate-150 pb-2.5">
                          <div className="flex items-center gap-3.5 min-w-0">
                            {getAvatar(ath.name, ath.gender, ath.avatarUrl, "w-10 h-10 border-2 border-indigo-200 shadow-sm bg-white")}
                            <div className="min-w-0">
                              <h4 className="text-xs font-black text-slate-800 block truncate leading-none">{ath.name}</h4>
                              <span className="text-[10px] text-slate-450 font-bold block mt-1.5 uppercase leading-none truncate max-w-[200px]">
                                {ath.team || "Tuyển Thủ Tự Do"} &bull; ID: {ath.id}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-black font-semibold text-indigo-600 block leading-none font-sans">
                              {totalScore} ĐIỂM
                            </span>
                            <span className="text-[9.5px] font-black font-mono text-emerald-600 block leading-none mt-1">
                              {accuracy.toFixed(1)}% ({totalHits}/{renderDists.length * effectiveShotsCount})
                            </span>
                          </div>
                        </div>

                        {/* Scores breakdown rows stacked vertically */}
                        <div className="flex flex-col gap-2">
                          {renderDists.map((dist) => {
                            const hits = ath.scores?.[dist.id] || [];
                            const hitCount = getHitCount(hits);
                            const score = hitCount * dist.multiplier;

                            return (
                              <div 
                                key={dist.id} 
                                className="bg-slate-50 border border-slate-150 p-2 rounded-2xl flex items-center justify-between gap-4 shadow-sm"
                              >
                                {/* Left: Distance info & score */}
                                <div className="flex flex-col shrink-0 text-left">
                                  <span className="text-[10px] font-black text-slate-800 uppercase tracking-wide">
                                    Cự ly {dist.distance} (x{dist.multiplier})
                                  </span>
                                  <span className="text-[9px] text-indigo-600 font-extrabold mt-0.5">
                                    {isDirectMode ? `Điểm số ${hitCount}/${effectiveShotsCount}` : `Trúng ${hitCount}/${shotsCount}`}
                                  </span>
                                </div>
                                
                                {/* Center: Checked targets circles representation */}
                                <div className="flex-1 flex justify-center overflow-x-auto py-0.5 scrollbar-thin">
                                  <div className="flex gap-1 justify-center items-center">
                                    {Array(effectiveShotsCount).fill(null).map((_, shotIdx) => {
                                      const hit = hits[shotIdx];
                                      let circleBgClass = "bg-white border-slate-200 text-slate-400";
                                      if (hit === true) circleBgClass = "bg-emerald-500 border-emerald-600 text-white font-extrabold shadow shadow-emerald-700/30";
                                      else if (hit === false) circleBgClass = "bg-red-50 border-red-150 text-red-500/70";
                                      else if (typeof hit === "number") {
                                        circleBgClass = hit > 0 
                                          ? "bg-indigo-500 border-indigo-600 text-white font-black shadow-sm" 
                                          : "bg-slate-100 border-slate-200 text-slate-400";
                                      }
                                      
                                      return (
                                        <div 
                                          key={shotIdx}
                                          className={`w-[20px] h-[20px] rounded text-[9px] font-mono font-black flex items-center justify-center border leading-none shrink-0 ${circleBgClass}`}
                                        >
                                          {typeof hit === "number" ? hit : (hit === true ? "✓" : (hit === false ? "✕" : shotIdx + 1))}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Right: Total score check badge */}
                                <div className="shrink-0 text-right">
                                  <span className="text-[10px] font-black font-mono px-2 py-1 rounded-xl bg-indigo-50 border border-indigo-150 text-indigo-600 shadow-sm block">
                                    +{score}đ
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* Poster Footer */}
              <div className="h-[100px] bg-indigo-950 border-t border-indigo-900 px-8 flex items-center justify-between shrink-0 relative z-10 text-indigo-200">
                <span className="text-[11px] text-indigo-200 font-bold max-w-[480px]">
                  Ứng dụng tính điểm Ná Slingshot chính thức • Kênh truyền thông: vsc.vietnamslingshot
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-300 font-black">
                    Trang {chunkIdx + 1} / {totalPages}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* PAGE type: SCORING BOARD TEAM DETAILS */}
        {selectedTabs.scoringTeam && activeAthletesTeam.length > 0 && paginatedScoringTeamVisible.map((chunk, chunkIdx) => {
          const totalPages = paginatedScoringTeamVisible.length;
          const effectiveShotsCount = effectiveShotsCountTeam;
          const effectiveDirectMaxPoints = effectiveDirectMaxPointsTeam;
          return (
            <div 
              key={`scoring-team-${chunkIdx}`}
              id={`export-scoring-team-${chunkIdx + 1}`}
              data-export-page="scoring-team"
              className={`${aspectRatio === "16:9" ? "w-[1422px] h-[800px]" : "w-[800px] h-[1422px]"} bg-slate-50 text-slate-900 flex flex-col justify-between overflow-hidden relative shadow-2xl shrink-0`}
              style={{ width: aspectRatio === "16:9" ? "1422px" : "800px", height: aspectRatio === "16:9" ? "800px" : "1422px" }}
            >
              {/* Overlay graphics */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.06),transparent_60%)] z-0" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.04),transparent_50%15)] z-0" />

              {/* Poster Header */}
              <div className="h-[140px] bg-gradient-to-r from-indigo-900 via-indigo-950 to-indigo-900 border-b border-indigo-200 px-8 flex items-center justify-between shrink-0 relative z-10 shadow-sm text-white">
                <div className="flex items-center gap-4">
                  <div className="bg-white/10 p-1.5 rounded-2xl border border-white/20 shrink-0 shadow-sm">
                    <VSCLogo size={50} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] uppercase font-serif font-black tracking-widest bg-amber-450 text-slate-950 px-2 rounded-full leading-none py-0.5">
                        VSC OFFICIAL
                      </span>
                      <span className="text-[9.5px] uppercase font-mono tracking-widest text-indigo-305 font-black leading-none">
                        DETAILS REPORT
                      </span>
                    </div>
                    <h1 className="text-sm font-black text-white uppercase tracking-tight leading-tight mt-1 truncate max-w-[420px]">
                      {matchName}
                    </h1>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-amber-300 uppercase font-mono tracking-widest block">
                    GHI ĐIỂM TEAM CHI TIẾT (ĐỒNG ĐỘI)
                  </span>
                  <span className="text-[10px] text-indigo-150 font-bold block mt-0.5 font-sans">
                    {new Date().toLocaleDateString("vi-VN")} {new Date().toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Poster Main Body content inside */}
              <div className="flex-1 p-8 flex flex-col gap-3.5 relative z-10 justify-start overflow-hidden">
                
                {/* Title */}
                <div className="text-center bg-indigo-50 border border-indigo-100 p-3 rounded-2xl shrink-0">
                  <h3 className="text-xs font-black uppercase text-indigo-900 tracking-wider font-sans">
                    {`Sổ Điểm Chi Tiết Thử Thách Team - Trang ${chunkIdx + 1}`}
                  </h3>
                </div>

                {/* Athlete Detail Cards list */}
                <div className={`flex-1 overflow-hidden py-1 ${aspectRatio === "16:9" ? "grid grid-cols-2 gap-4 auto-rows-max justify-start items-start" : "flex flex-col gap-3.5 justify-start"}`}>
                  {chunk.map((ath, idx) => {
                    // Pre-calc total score & hits using team settings
                    let totalScore = 0;
                    let totalHits = 0;
                    actualTeamDistances.forEach((dist) => {
                      const hits = ath.scores?.[dist.id] || [];
                      const hCount = getLeaderboardHitCountTeam(hits);
                      totalScore += hCount * dist.multiplier;
                      totalHits += hCount;
                    });

                    // Filter only active distances with recorded score
                    const activeDistances = actualTeamDistances.filter((dist) => {
                      const hits = ath.scores?.[dist.id];
                      return hits && hits.length > 0 && hits.some(v => v !== null && v !== undefined);
                    });
                    
                    const renderDists = activeDistances.length > 0 ? activeDistances : (actualTeamDistances.length > 0 ? [actualTeamDistances[0]] : []);

                    let accuracy = 0;
                    if (teamIsDirectMode && effectiveDirectMaxPoints !== undefined && effectiveDirectMaxPoints > 0) {
                      const totalPossiblePoints = effectiveDirectMaxPoints * renderDists.reduce((sum, d) => sum + d.multiplier, 0);
                      accuracy = totalPossiblePoints > 0 ? (totalScore / totalPossiblePoints) * 100 : 0;
                    } else {
                      const totalPossibleShots = renderDists.length * effectiveShotsCount;
                      accuracy = totalPossibleShots > 0 ? (totalHits / totalPossibleShots) * 100 : 0;
                    }

                    return (
                      <div 
                        key={`exp-sc-team-${ath.id || "ath"}-${idx}`}
                        className="bg-white border border-slate-200 p-4 rounded-3xl flex flex-col gap-3 shrink-0 w-full justify-between relative overflow-hidden shadow-sm transition-all"
                      >
                        {/* Athlete header card */}
                        <div className="flex justify-between items-center shrink-0 border-b border-dashed border-slate-150 pb-2.5">
                          <div className="flex items-center gap-3.5 min-w-0">
                            {getAvatar(ath.name, ath.gender, ath.avatarUrl, "w-10 h-10 border-2 border-indigo-200 shadow-sm bg-white")}
                            <div className="min-w-0">
                              <h4 className="text-xs font-black text-slate-800 block truncate leading-none">{ath.name}</h4>
                              <span className="text-[10px] text-slate-450 font-bold block mt-1.5 uppercase leading-none truncate max-w-[200px]">
                                {ath.team || "Tuyển Thủ Tự Do"} &bull; ID: {ath.id}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-black font-semibold text-indigo-600 block leading-none font-sans">
                              {totalScore} ĐIỂM
                            </span>
                            <span className="text-[9.5px] font-black font-mono text-emerald-600 block leading-none mt-1">
                              {accuracy.toFixed(1)}% ({totalHits}/{renderDists.length * effectiveShotsCount})
                            </span>
                          </div>
                        </div>

                        {/* Scores breakdown rows stacked vertically */}
                        <div className="flex flex-col gap-2">
                          {renderDists.map((dist) => {
                            const hits = ath.scores?.[dist.id] || [];
                            const hitCount = getHitCount(hits);
                            const score = hitCount * dist.multiplier;

                            return (
                              <div 
                                key={dist.id} 
                                className="bg-slate-50 border border-slate-150 p-2 rounded-2xl flex items-center justify-between gap-4 shadow-sm"
                              >
                                <div className="flex flex-col shrink-0 text-left">
                                  <span className="text-[10px] font-black text-slate-800 uppercase tracking-wide">
                                    Cự ly {dist.distance} (x{dist.multiplier})
                                  </span>
                                  <span className="text-[9px] text-indigo-600 font-extrabold mt-0.5">
                                    {teamIsDirectMode ? `Điểm số ${hitCount}/${effectiveShotsCount}` : `Trúng ${hitCount}/${actualTeamShotsCount}`}
                                  </span>
                                </div>
                                
                                <div className="flex-1 flex justify-center overflow-x-auto py-0.5 scrollbar-thin">
                                  <div className="flex gap-1 justify-center items-center">
                                    {Array(effectiveShotsCount).fill(null).map((_, shotIdx) => {
                                      const hit = hits[shotIdx];
                                      let circleBgClass = "bg-white border-slate-205 text-slate-400";
                                      if (hit === true) circleBgClass = "bg-emerald-500 border-emerald-600 text-white font-extrabold shadow shadow-emerald-700/30";
                                      else if (hit === false) circleBgClass = "bg-red-50 border-red-150 text-red-500/70";
                                      else if (typeof hit === "number") {
                                        circleBgClass = hit > 0 
                                          ? "bg-indigo-500 border-indigo-600 text-white font-black shadow-sm" 
                                          : "bg-slate-100 border-slate-205 text-slate-400";
                                      }
                                      
                                      return (
                                        <div 
                                          key={shotIdx}
                                          className={`w-[20px] h-[20px] rounded text-[9px] font-mono font-black flex items-center justify-center border leading-none shrink-0 ${circleBgClass}`}
                                        >
                                          {typeof hit === "number" ? hit : (hit === true ? "✓" : (hit === false ? "✕" : shotIdx + 1))}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="shrink-0 text-right">
                                  <span className="text-[10px] font-black font-mono px-2 py-1 rounded-xl bg-indigo-50 border border-indigo-150 text-indigo-600 shadow-sm block">
                                    +{score}đ
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* Poster Footer */}
              <div className="h-[100px] bg-indigo-950 border-t border-indigo-900 px-8 flex items-center justify-between shrink-0 relative z-10 text-indigo-200">
                <span className="text-[11px] text-indigo-200 font-bold max-w-[480px]">
                  Ứng dụng tính điểm Ná Slingshot chính thức • Kênh truyền thông: vsc.vietnamslingshot
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-300 font-black">
                     Trang {chunkIdx + 1} / {totalPages}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

      </div>

    </div>
  );
};
