import React, { useState, useMemo } from "react";
import { Athlete, DistanceConfig } from "../types";
import { Trophy, Medal, Award, Search, ArrowUpDown, Building, Info } from "lucide-react";
import { AVATAR_MALE } from "./AthleteManagement";
import { calculateRounds } from "../utils/qualification";

interface LeaderboardProps {
  athletes: Athlete[];
  distances: DistanceConfig[];
  shotsCount: number;
  competitionMode?: "individual" | "team";
  directMaxShots?: number;
  teamDirectMaxShots?: number;
  directMaxPoints?: number;
  teamDirectMaxPoints?: number;
}

type SortField = "rank" | "name" | "team" | "accuracy" | "teamScore";

export const Leaderboard: React.FC<LeaderboardProps> = ({ 
  athletes, 
  distances, 
  shotsCount, 
  competitionMode,
  directMaxShots,
  teamDirectMaxShots,
  directMaxPoints,
  teamDirectMaxPoints,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortAsc, setSortAsc] = useState(false);
  const [showTopXOnly, setShowTopXOnly] = useState(false);
  const [topXLimit, setTopXLimit] = useState<number>(10);
  const [selectedRoundTab, setSelectedRoundTab] = useState<number | "all">("all");

  const isDirectMode = shotsCount === 1;

  const effectiveShotsCount = isDirectMode
    ? (competitionMode === "team" ? (teamDirectMaxShots || 10) : (directMaxShots || 10))
    : shotsCount;

  const effectiveDirectMaxPoints = competitionMode === "team" ? teamDirectMaxPoints : directMaxPoints;
  const isPointModeActive = isDirectMode && effectiveDirectMaxPoints !== undefined && effectiveDirectMaxPoints > 0;

  const getLeaderboardHitCount = (hits: any[]) => {
    if (isDirectMode && hits[0] !== null && hits[0] !== undefined) {
      const parsed = Number(hits[0]);
      return isNaN(parsed) ? 0 : parsed;
    }
    return hits.filter(Boolean).length;
  };

  // All active athletes: in team mode, only include those who are primary team players (bắn chính)
  const activeAthletes = useMemo(() => {
    if (competitionMode === "team") {
      return athletes.filter((a) => a.isPrimaryTeam);
    }
    return athletes;
  }, [athletes, competitionMode]);

  // All unique teams
  const uniqueTeams = useMemo(() => {
    const teams = new Set<string>();
    activeAthletes.forEach((athlete) => {
      if (athlete.team.trim()) {
        teams.add(athlete.team.trim());
      }
    });
    return Array.from(teams);
  }, [activeAthletes]);

  // Compute qualifications and rounds results
  const roundResults = useMemo(() => {
    const effectiveDirectMaxPoints = competitionMode === "team" ? teamDirectMaxPoints : directMaxPoints;
    return calculateRounds(activeAthletes, distances, effectiveShotsCount, effectiveDirectMaxPoints);
  }, [activeAthletes, distances, effectiveShotsCount, competitionMode, directMaxPoints, teamDirectMaxPoints]);

  // Group and compute round-by-round team progression in team competition mode
  const teamRoundResults = useMemo(() => {
    if (competitionMode !== "team") return [] as any[];

    const results: any[] = [];
    const teamCumulativeScores: Record<string, number> = {};
    const teamCumulativeHits: Record<string, number> = {};

    const activeTeams = Array.from(new Set(activeAthletes.map((a) => {
      const raw = a.team.trim();
      return raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
    }))) as string[];

    for (let r = 0; r < distances.length; r++) {
      const dist = distances[r];
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
          roundHits += getLeaderboardHitCount(hits);
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
        if (isDirectMode && teamDirectMaxPoints !== undefined && teamDirectMaxPoints > 0) {
          let totalMultiplier = 0;
          if (dist.isCumulative) {
            for (let i = 0; i <= r; i++) {
              totalMultiplier += distances[i].multiplier;
            }
          } else {
            totalMultiplier = dist.multiplier;
          }
          const totalPossPoints = activeMembers.length * teamDirectMaxPoints * totalMultiplier;
          accuracy = totalPossPoints > 0 ? (displayScore / totalPossPoints) * 100 : 0;
        } else {
          const totalPossShots = activeMembers.length * (dist.isCumulative ? (r + 1) * effectiveShotsCount : effectiveShotsCount);
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

          // Check if any team in the round is not finished shooting yet (or specifically contenders/purely eliminated)
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

      // Update activeTeams for next round
      activeTeams.length = 0;
      activeTeams.push(...nextRoundTeams);
    }

    return results;
  }, [activeAthletes, distances, shotsCount, competitionMode]);

  // Group and compute active team scores in team competition mode
  const activeTeamScores = useMemo(() => {
    if (competitionMode !== "team") return {} as Record<string, number>;
    const scores: Record<string, number> = {};
    const hasMaxRoundScoreConf = distances.some(d => d.isMaxRoundScore);

    if (selectedRoundTab === "all" && hasMaxRoundScoreConf) {
      // Sum each athlete's individual maximum score
      const teamsList = Array.from(new Set(activeAthletes.map((a) => {
        const raw = a.team.trim();
        return raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
      }))) as string[];

      teamsList.forEach((teamName) => {
        const members = activeAthletes.filter((a) => {
          const raw = a.team.trim();
          const t = raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
          return t === teamName && a.isPrimaryTeam && a.status !== "Bỏ thi";
        });

        let teamScoreSum = 0;
        let teamSoloSum = 0;

        members.forEach((athlete) => {
          let maxScore = -1;
          let maxSoloHits = 0;

          distances.forEach((distance, rIdx) => {
            const isQualified = rIdx === 0 || (teamRoundResults[rIdx]?.qualifiedTeams.includes(teamName));
            if (isQualified) {
              const hits = athlete.scores[distance.id] || [];
              const hitCount = getLeaderboardHitCount(hits);
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
      activeAthletes.forEach((athlete) => {
        // In team mode, only primary team members contribute to team score
        if (!athlete.isPrimaryTeam) return;

        const rawTeam = athlete.team.trim();
        const teamName = rawTeam === "" ? "VĐV Tự Do (Không Đội)" : rawTeam;

        let personalScore = 0;
        let personalSolo = 0;
        if (selectedRoundTab === "all") {
          distances.forEach((distance, rIdx) => {
            const isQualified = rIdx === 0 || (teamRoundResults[rIdx]?.qualifiedTeams.includes(teamName));
            if (isQualified) {
              const hits = athlete.scores[distance.id] || [];
              const hitCount = getLeaderboardHitCount(hits);
              personalScore += hitCount * distance.multiplier;

              const soloVal = athlete.soloHits?.[distance.id];
              const soloHitsNum = (soloVal === null || soloVal === undefined) ? 0 : soloVal;
              personalSolo += soloHitsNum;
            }
          });
        } else {
          const isQualified = selectedRoundTab === 0 || (teamRoundResults[selectedRoundTab]?.qualifiedTeams.includes(teamName));
          if (isQualified) {
            const roundRes = roundResults[selectedRoundTab];
            if (roundRes) {
              const stats = roundRes.scores[athlete.id];
              personalScore = stats ? stats.displayScore : 0;
            }
            const currentRoundDist = distances[selectedRoundTab];
            const soloVal = currentRoundDist ? athlete.soloHits?.[currentRoundDist.id] : undefined;
            const soloHitsNum = (soloVal === null || soloVal === undefined) ? 0 : soloVal;
            personalSolo += soloHitsNum;
          }
        }

        scores[teamName] = (scores[teamName] || 0) + personalScore + (personalSolo * 0.001);
      });
    }

    return scores;
  }, [activeAthletes, distances, selectedRoundTab, roundResults, teamRoundResults, competitionMode]);

  // Compute calculated statistics for all athletes based on active round/view selection
  const rankedAthletes = useMemo(() => {
    const hasMaxRoundScoreConf = distances.some(d => d.isMaxRoundScore);
    // Process common properties for all athletes including survival metrics
    const athletesWithSurvival = activeAthletes.map((athlete) => {
      // Find which round they were eliminated in (if any) or if they have a pending solo/resolo
      let eliminatedInRoundIdx: number | null = null;
      let isSoloPendingGlobal = false;
      let isResoloPendingGlobal = false;

      if (competitionMode === "team") {
        const raw = athlete.team.trim();
        const teamName = raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
        for (let i = 0; i < teamRoundResults.length; i++) {
          if (teamRoundResults[i].eliminatedTeams.includes(teamName)) {
            eliminatedInRoundIdx = i;
            break;
          }
        }

        for (let i = 0; i < teamRoundResults.length; i++) {
          if (teamRoundResults[i].pendingSoloTeams?.includes(teamName)) {
            isSoloPendingGlobal = true;
            break;
          }
          if (teamRoundResults[i].pendingResoloTeams?.includes(teamName)) {
            isResoloPendingGlobal = true;
            break;
          }
        }
      } else {
        for (let i = 0; i < roundResults.length; i++) {
          let hasSubsequentParticipation = false;
          for (let j = i + 1; j < roundResults.length; j++) {
            if (roundResults[j].qualifiedIds.includes(athlete.id)) {
              hasSubsequentParticipation = true;
              break;
            }
          }
          if (hasSubsequentParticipation) {
            continue;
          }

          if (roundResults[i].pendingSoloIds?.includes(athlete.id)) {
            isSoloPendingGlobal = true;
            break;
          }
          if (roundResults[i].pendingResoloIds?.includes(athlete.id)) {
            isResoloPendingGlobal = true;
            break;
          }
          if (roundResults[i].eliminatedIds.includes(athlete.id)) {
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

      if (distances.length > 0 && lastActiveRoundIdx >= 0) {
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
            const isQualifiedForRound = competitionMode === "team"
              ? (i === 0 || teamRoundResults[i]?.qualifiedTeams.includes(athlete.team.trim() === "" ? "VĐV Tự Do (Không Đội)" : athlete.team.trim()))
              : (i === 0 || roundResults[i]?.qualifiedIds.includes(athlete.id));

            if (isQualifiedForRound) {
              const dist = distances[i];
              const hits = athlete.scores[dist.id] || [];
              const hitCount = getLeaderboardHitCount(hits);
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
          if (isPointModeActive && effectiveDirectMaxPoints !== undefined) {
            if (cumulativeMultiplierSumInShotRounds === 0 && distances[lastActiveRoundIdx]) {
              cumulativeMultiplierSumInShotRounds = distances[lastActiveRoundIdx].multiplier;
            }
            const totalPossPoints = effectiveDirectMaxPoints * cumulativeMultiplierSumInShotRounds;
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
            if (isPointModeActive && effectiveDirectMaxPoints !== undefined) {
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
              const totalPossPoints = effectiveDirectMaxPoints * totalMultiplier;
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

      let isUnshot = false;
      for (let r = 0; r < distances.length; r++) {
        const isQualifiedForRound = competitionMode === "team"
          ? (r === 0 || teamRoundResults[r]?.qualifiedTeams.includes(athlete.team.trim() === "" ? "VĐV Tự Do (Không Đội)" : athlete.team.trim()))
          : (r === 0 || roundResults[r]?.qualifiedIds.includes(athlete.id));
        if (isQualifiedForRound) {
          const rDist = distances[r];
          const rScores = rDist ? athlete.scores[rDist.id] : undefined;
          const isUnshotInThisRound = !rScores || rScores.length === 0 || rScores.every((val: any) => val === null);
          if (isUnshotInThisRound) {
            isUnshot = true;
            break;
          }
        }
      }

      return {
        athlete,
        eliminatedInRoundIdx,
        isSoloPendingGlobal,
        isResoloPendingGlobal,
        survivalVal,
        survivalScore,
        survivalHits,
        survivalAccuracy,
        survivalSoloHits,
        isUnshot,
      };
    });

    if (selectedRoundTab === "all") {
      // Standard multi-round calculation
      return athletesWithSurvival.map(({ athlete, eliminatedInRoundIdx, isSoloPendingGlobal, isResoloPendingGlobal, survivalVal, survivalScore, survivalHits, survivalAccuracy, survivalSoloHits }) => {
        let totalScore = 0;
        let totalHits = 0;
        
        const breakdown = distances.map((distance, rIdx) => {
          const isQualified = rIdx === 0 || (
            competitionMode === "team"
              ? teamRoundResults[rIdx]?.qualifiedTeams.includes(athlete.team.trim() === "" ? "VĐV Tự Do (Không Đội)" : athlete.team.trim())
              : roundResults[rIdx]?.qualifiedIds.includes(athlete.id)
          );
          const hits = isQualified ? (athlete.scores[distance.id] || []) : [];
          const hitCount = getLeaderboardHitCount(hits);
          const score = hitCount * distance.multiplier;
          
          totalScore += score;
          totalHits += hitCount;

          return {
            distanceName: distance.distance,
            distanceId: distance.id,
            multiplier: distance.multiplier,
            hitCount,
            maxHits: isPointModeActive && effectiveDirectMaxPoints !== undefined ? effectiveDirectMaxPoints : effectiveShotsCount,
            score,
            isQualified,
          };
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

        const totalPossibleShots = isPointModeActive && effectiveDirectMaxPoints !== undefined
          ? effectiveDirectMaxPoints * totalMultiplierOfShotRounds
          : countShotRounds * effectiveShotsCount;
        const calculatedAccuracy = isPointModeActive && effectiveDirectMaxPoints !== undefined
          ? (totalPossibleShots > 0 ? (totalScore / totalPossibleShots) * 100 : 0)
          : (totalPossibleShots > 0 ? (totalHits / totalPossibleShots) * 100 : 0);

        const totalScoreValue = hasMaxRoundScoreConf ? survivalScore : totalScore;
        const totalHitsValue = totalHits;
        const accuracyValue = calculatedAccuracy;

        let finalPossibleShots = totalPossibleShots;

        // An athlete is unshot overall if they have not shot any arrow/scores in any of the distances
        const isUnshotOverall = distances.every((dist) => {
          const rScores = athlete.scores[dist.id];
          return !rScores || rScores.length === 0 || rScores.every((val: any) => val === null);
        });

        return {
          ...athlete,
          totalScore: totalScoreValue,
          totalScoreWithSolo: totalScoreValue, // No solo shootout in cumulative summary
          totalHits: totalHitsValue,
          totalPossibleShots: finalPossibleShots,
          accuracy: accuracyValue,
          breakdown,
          isQualifiedNow: eliminatedInRoundIdx === null,
          eliminatedInRoundIdx,
          wasEliminatedEarlier: false,
          isEliminatedThisRound: false,
          isSoloPending: isSoloPendingGlobal,
          isResoloPending: isResoloPendingGlobal,
          isUnshot: isUnshotOverall,
          survivalVal,
          survivalScore,
          survivalHits,
          survivalAccuracy,
          survivalSoloHits,
        };
      });
    } else {
      // Single Round leaderboard!
      const roundRes = roundResults[selectedRoundTab];
      const teamRes = teamRoundResults[selectedRoundTab];
      const roundConfig = distances[selectedRoundTab];

      return athletesWithSurvival.map(({ athlete, eliminatedInRoundIdx, isSoloPendingGlobal, isResoloPendingGlobal, survivalVal, survivalScore, survivalHits, survivalAccuracy, survivalSoloHits }) => {
        const teamName = athlete.team.trim() === "" ? "VĐV Tự Do (Không Đội)" : athlete.team.trim();

        const isQualified = competitionMode === "team"
          ? (teamRes ? teamRes.qualifiedTeams.includes(teamName) : true)
          : (roundRes ? roundRes.qualifiedIds.includes(athlete.id) : true);

        const isEliminatedThisRound = competitionMode === "team"
          ? (teamRes ? teamRes.eliminatedTeams.includes(teamName) : false)
          : (roundRes ? roundRes.eliminatedIds.includes(athlete.id) : false);

        const stats = (roundRes && roundRes.scores[athlete.id]) || {
          roundHits: 0,
          roundScore: 0,
          cumulativeHits: 0,
          cumulativeScore: 0,
          displayScore: 0,
          displayHits: 0,
          accuracy: 0,
          displayScoreWithSolo: 0,
        };

        const breakdown = distances.slice(0, selectedRoundTab + 1).map((dist, idx) => {
          const wasQual = competitionMode === "team"
            ? (teamRoundResults[idx]?.qualifiedTeams.includes(teamName))
            : (roundResults[idx]?.qualifiedIds.includes(athlete.id));

          const hits = wasQual ? (athlete.scores[dist.id] || []) : [];
          const hitCount = getLeaderboardHitCount(hits);
          const score = hitCount * dist.multiplier;
          return {
            distanceName: dist.distance,
            distanceId: dist.id,
            multiplier: dist.multiplier,
            hitCount,
            maxHits: isPointModeActive && effectiveDirectMaxPoints !== undefined ? effectiveDirectMaxPoints : effectiveShotsCount,
            score,
            isQualified: wasQual,
          };
        });

        const totalScoreWithSolo = stats.displayScoreWithSolo !== undefined ? stats.displayScoreWithSolo : stats.displayScore;

        const isSoloPending = competitionMode === "team"
          ? (teamRes?.pendingSoloTeams?.includes(teamName) || false)
          : (roundRes?.pendingSoloIds?.includes(athlete.id) || false);

        const isResoloPending = competitionMode === "team"
          ? (teamRes?.pendingResoloTeams?.includes(teamName) || false)
          : (roundRes?.pendingResoloIds?.includes(athlete.id) || false);

        // Check if unshot specifically in this active round
        const currentRoundDist = typeof selectedRoundTab === "number" ? distances[selectedRoundTab] : undefined;
        const rScores = currentRoundDist ? athlete.scores[currentRoundDist.id] : undefined;
        const isUnshotInThisRound = !rScores || rScores.length === 0 || rScores.every((val: any) => val === null);

        let calculatedPossShots = 0;
        if (isPointModeActive && effectiveDirectMaxPoints !== undefined && roundConfig) {
          if (roundConfig.isCumulative) {
            let totalMultiplier = 0;
            for (let i = 0; i <= (selectedRoundTab as number); i++) {
              const distI = distances[i];
              const wasShot = athlete.scores[distI.id] && athlete.scores[distI.id].length > 0 && athlete.scores[distI.id].some(v => v !== null && v !== undefined);
              if (wasShot) {
                totalMultiplier += distI.multiplier;
              }
            }
            if (totalMultiplier === 0) {
              totalMultiplier = roundConfig.multiplier;
            }
            calculatedPossShots = effectiveDirectMaxPoints * totalMultiplier;
          } else {
            calculatedPossShots = effectiveDirectMaxPoints * roundConfig.multiplier;
          }
        } else {
          if (roundConfig?.isCumulative) {
            let shotRoundsCount = 0;
            for (let i = 0; i <= (selectedRoundTab as number); i++) {
              const distI = distances[i];
              const wasShot = athlete.scores[distI.id] && athlete.scores[distI.id].length > 0 && athlete.scores[distI.id].some(v => v !== null && v !== undefined);
              if (wasShot) {
                shotRoundsCount++;
              }
            }
            if (shotRoundsCount === 0) {
              shotRoundsCount = 1;
            }
            calculatedPossShots = shotRoundsCount * effectiveShotsCount;
          } else {
            calculatedPossShots = effectiveShotsCount;
          }
        }

        return {
          ...athlete,
          totalScore: stats.displayScore, // Either cumulative or raw depending on isCumulative (displayed officially)
          totalScoreWithSolo, // Hidden sorting score with solo hits included
          totalHits: stats.displayHits,
          totalPossibleShots: calculatedPossShots,
          accuracy: stats.accuracy,
          breakdown,
          isQualifiedNow: isQualified && !isEliminatedThisRound,
          isEliminatedThisRound,
          wasEliminatedEarlier: !isQualified,
          eliminatedInRoundIdx,
          isSoloPending,
          isResoloPending,
          isUnshot: isUnshotInThisRound,
          survivalVal,
          survivalScore,
          survivalHits,
          survivalAccuracy,
          survivalSoloHits,
        };
      });
    }
  }, [activeAthletes, distances, shotsCount, selectedRoundTab, roundResults, teamRoundResults, competitionMode]);

  // Sort athletes based on totalScoreWithSolo and tie-breakers (accuracy)
  const sortedAthletes = useMemo(() => {
    // We sort rankedAthletes by score descending initially to establish absolute standard rank
    const baseRanked = [...rankedAthletes].sort((a, b) => {
      const isABỏThi = a.status === "Bỏ thi";
      const isBBỏThi = b.status === "Bỏ thi";
      if (isABỏThi && !isBBỏThi) return 1;
      if (!isABỏThi && isBBỏThi) return -1;

      if (competitionMode === "team") {
        const teamNameA = a.team.trim() === "" ? "VĐV Tự Do (Không Đội)" : a.team.trim();
        const teamNameB = b.team.trim() === "" ? "VĐV Tự Do (Không Đội)" : b.team.trim();
        const scoreA = activeTeamScores[teamNameA] || 0;
        const scoreB = activeTeamScores[teamNameB] || 0;

        // 1. Compare team survival / active status
        if (selectedRoundTab === "all") {
          if (b.survivalVal !== a.survivalVal) {
            return b.survivalVal - a.survivalVal;
          }
        } else {
          // If in a specific round, check who was eliminated earlier
          if (a.wasEliminatedEarlier && !b.wasEliminatedEarlier) return 1;
          if (!a.wasEliminatedEarlier && b.wasEliminatedEarlier) return -1;

          if (a.wasEliminatedEarlier) {
            if (b.survivalVal !== a.survivalVal) {
              return b.survivalVal - a.survivalVal;
            }
          }
        }

        // 2. Compare team scores
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }

        // Group teams with equal scores/survival together: compare their team names alphabetically
        const teamNameComp = teamNameA.localeCompare(teamNameB, "vi");
        if (teamNameComp !== 0) {
          return teamNameComp;
        }

        // Tie-breakers: Within same team, sort by individual total score
        if (b.totalScoreWithSolo !== a.totalScoreWithSolo) {
          return b.totalScoreWithSolo - a.totalScoreWithSolo;
        }
        return b.accuracy - a.accuracy;
      }

      if (selectedRoundTab === "all") {
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
      } else {
        // Put earlier-eliminated at the bottom
        if (a.wasEliminatedEarlier && !b.wasEliminatedEarlier) return 1;
        if (!a.wasEliminatedEarlier && b.wasEliminatedEarlier) return -1;

        if (a.wasEliminatedEarlier) {
          // Both are earlier-eliminated cohort: sort by survival properties
          if (a.survivalVal !== b.survivalVal) {
            return b.survivalVal - a.survivalVal;
          }
          if (b.survivalScore !== a.survivalScore) {
            return b.survivalScore - a.survivalScore;
          }
          if (b.survivalSoloHits !== a.survivalSoloHits) {
            return b.survivalSoloHits - a.survivalSoloHits;
          }
          return b.survivalAccuracy - a.survivalAccuracy;
        }

        // Sort by hidden score which includes solo shootout if active
        if (b.totalScoreWithSolo !== a.totalScoreWithSolo) {
          return b.totalScoreWithSolo - a.totalScoreWithSolo;
        }

        return b.accuracy - a.accuracy; // tie-breaker is accuracy
      }
    });

    // Compute team ranks for all unique teams in Team Mode
    const teamStats: Record<string, { survivalVal: number; score: number }> = {};
    if (competitionMode === "team") {
      rankedAthletes.forEach((ath) => {
        const rawTeam = ath.team.trim();
        const teamName = rawTeam === "" ? "VĐV Tự Do (Không Đội)" : rawTeam;
        if (!teamStats[teamName]) {
          teamStats[teamName] = {
            survivalVal: ath.survivalVal,
            score: activeTeamScores[teamName] || 0,
          };
        }
      });
    }

    const teamNames = Object.keys(teamStats);
    const teamRanks: Record<string, number> = {};
    if (competitionMode === "team") {
      teamNames.forEach((tName) => {
        const tStats = teamStats[tName];
        let betterTeamsCount = 0;
        
        teamNames.forEach((otherName) => {
          if (otherName === tName) return;
          const otherStats = teamStats[otherName];
          
          let isOtherBetter = false;
          if (selectedRoundTab === "all") {
            if (otherStats.survivalVal !== tStats.survivalVal) {
              isOtherBetter = otherStats.survivalVal > tStats.survivalVal;
            } else {
              isOtherBetter = otherStats.score > tStats.score;
            }
          } else {
            const roundIdx = typeof selectedRoundTab === "number" ? selectedRoundTab : 0;
            const selfActive = tStats.survivalVal >= roundIdx;
            const otherActive = otherStats.survivalVal >= roundIdx;
            
            if (otherActive && !selfActive) {
              isOtherBetter = true;
            } else if (!otherActive && selfActive) {
              isOtherBetter = false;
            } else if (!otherActive && !selfActive) {
              if (otherStats.survivalVal !== tStats.survivalVal) {
                isOtherBetter = otherStats.survivalVal > tStats.survivalVal;
              } else {
                isOtherBetter = otherStats.score > tStats.score;
              }
            } else {
              isOtherBetter = otherStats.score > tStats.score;
            }
          }
          
          if (isOtherBetter) {
            betterTeamsCount++;
          }
        });
        
        teamRanks[tName] = betterTeamsCount + 1;
      });
    }

    // Assign rank ranks with joint ranking support
    const withRank = baseRanked.map((athlete, idx) => {
      let betterCount = 0;
      if (athlete.status === "Bỏ thi") {
        return { ...athlete, baseRank: 999 };
      }

      if (competitionMode === "team") {
        const rawTeam = athlete.team.trim();
        const teamNameSelf = rawTeam === "" ? "VĐV Tự Do (Không Đội)" : rawTeam;
        const rankValue = teamRanks[teamNameSelf] || 1;
        return { ...athlete, baseRank: rankValue };
      }

      for (let j = 0; j < idx; j++) {
        const other = baseRanked[j];
        if (other.status === "Bỏ thi") continue;

        if (selectedRoundTab === "all") {
          // Compare exactly by the same sort criteria to assign tie/joint ranks
          if (other.survivalVal !== athlete.survivalVal) {
            if (other.survivalVal > athlete.survivalVal) betterCount++;
          } else if (other.survivalScore !== athlete.survivalScore) {
            if (other.survivalScore > athlete.survivalScore) betterCount++;
          } else if (other.survivalSoloHits !== athlete.survivalSoloHits) {
            if (other.survivalSoloHits > athlete.survivalSoloHits) betterCount++;
          } else if (other.survivalAccuracy !== athlete.survivalAccuracy) {
            if (other.survivalAccuracy > athlete.survivalAccuracy) betterCount++;
          }
        } else {
          if (other.wasEliminatedEarlier !== athlete.wasEliminatedEarlier) {
            if (!athlete.wasEliminatedEarlier && other.wasEliminatedEarlier) continue;
            if (athlete.wasEliminatedEarlier && !other.wasEliminatedEarlier) {
              if (other.status !== "Bỏ thi") {
                betterCount++;
              }
              continue;
            }
          }

          // Both are active, or both are eliminated
          if (other.status === "Bỏ thi") continue;

          if (!athlete.wasEliminatedEarlier) {
            if (other.totalScoreWithSolo > athlete.totalScoreWithSolo) {
              betterCount++;
            } else if (other.totalScoreWithSolo === athlete.totalScoreWithSolo) {
              // fallback to accuracy
              if (other.accuracy > athlete.accuracy) {
                betterCount++;
              }
            }
          } else {
            // Both earlier-eliminated: sort by survival properties
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
        }
      }
      return { ...athlete, baseRank: betterCount + 1 };
    });

    // Apply filters (search, team, top X)
    const filtered = withRank.filter((ath) => {
      // Starting from Round 2 onwards (selectedRoundTab >= 1), hide athletes who were eliminated earlier or dropped out
      if (selectedRoundTab !== "all" && typeof selectedRoundTab === "number" && selectedRoundTab >= 1) {
        if (ath.status === "Bỏ thi") {
          return false;
        }

        const isLastRound = selectedRoundTab === distances.length - 1;
        const activeCount = withRank.filter(a => !a.wasEliminatedEarlier && a.status !== "Bỏ thi").length;

        if (isLastRound && activeCount < 3) {
          if (!ath.wasEliminatedEarlier) {
            // Keep active
          } else {
            const earlierEliminated = withRank.filter(a => a.wasEliminatedEarlier && a.status !== "Bỏ thi");
            const toInclude = earlierEliminated.slice(0, 3 - activeCount);
            
            const isToInclude = toInclude.some(p => p.id === ath.id);
            if (!isToInclude) {
              return false;
            }
          }
        } else {
          if (ath.wasEliminatedEarlier) {
            return false;
          }
        }
      }

      const matchSearch = 
        ath.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        ath.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ath.team.toLowerCase().includes(searchTerm.toLowerCase());
      const matchTeam = selectedTeam === "all" || ath.team.trim() === selectedTeam.trim();
      const matchTopLimit = !showTopXOnly || ath.baseRank <= topXLimit;
      return matchSearch && matchTeam && matchTopLimit;
    });

    // Apply custom sort order if sorting is clicked
    return filtered.sort((a, b) => {
      const isABỏThi = a.status === "Bỏ thi";
      const isBBỏThi = b.status === "Bỏ thi";

      if (isABỏThi && !isBBỏThi) return 1;
      if (!isABỏThi && isBBỏThi) return -1;
      if (isABỏThi && isBBỏThi) {
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      }

      if (competitionMode === "team") {
        const teamNameA = a.team.trim() === "" ? "VĐV Tự Do (Không Đội)" : a.team.trim();
        const teamNameB = b.team.trim() === "" ? "VĐV Tự Do (Không Đội)" : b.team.trim();

        // 1. Group by team: compare the teams first to keep players of the same team contiguous
        let teamComparison = 0;
        if (sortField === "team") {
          teamComparison = teamNameA.localeCompare(teamNameB, "vi");
        } else {
          const rankA = teamRanks[teamNameA] || 999;
          const rankB = teamRanks[teamNameB] || 999;
          if (rankA !== rankB) {
            teamComparison = rankA - rankB;
          } else {
            // Equal team ranks: group teams together by name alphabetically to prevent interleaving
            teamComparison = teamNameA.localeCompare(teamNameB, "vi");
          }
        }

        // Apply sortAsc for team-level sorting (so clicking ascending/descending works on team headers)
        if (sortField === "team" || sortField === "teamScore" || sortField === "rank") {
          if (sortAsc) {
            teamComparison = -teamComparison;
          }
        }

        if (teamComparison !== 0) {
          return teamComparison;
        }

        // 2. Same team: sort individual athletes within the team block
        let indComparison = 0;
        if (sortField === "name") {
          indComparison = a.name.localeCompare(b.name);
        } else if (sortField === "accuracy") {
          indComparison = b.accuracy - a.accuracy;
        } else {
          // Default: inside same team, sort by individual score
          indComparison = b.totalScoreWithSolo - a.totalScoreWithSolo;
        }

        if (sortField === "name" || sortField === "accuracy") {
          if (sortAsc) {
            indComparison = -indComparison;
          }
        }

        return indComparison;
      }

      let comparison = 0;
      if (sortField === "rank") {
        comparison = a.baseRank - b.baseRank;
      } else if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === "team") {
        comparison = a.team.localeCompare(b.team);
      } else if (sortField === "teamScore") {
        const teamNameA = a.team.trim() === "" ? "VĐV Tự Do (Không Đội)" : a.team.trim();
        const teamNameB = b.team.trim() === "" ? "VĐV Tự Do (Không Đội)" : b.team.trim();
        const scoreA = activeTeamScores[teamNameA] || 0;
        const scoreB = activeTeamScores[teamNameB] || 0;
        comparison = scoreB - scoreA;
      } else if (sortField === "accuracy") {
        comparison = b.accuracy - a.accuracy;
      }

      return sortAsc ? -comparison : comparison;
    });
  }, [rankedAthletes, searchTerm, selectedTeam, showTopXOnly, topXLimit, sortField, sortAsc, competitionMode, activeTeamScores]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // default descending for metrics
    }
  };

  const getOnlyRankBadge = (rank: number, hasScore: boolean, athlete: any) => {
    if (athlete.status === "Bỏ thi") {
      return (
        <span className="font-mono text-xs text-gray-400 font-extrabold">-</span>
      );
    }
    if (!hasScore) {
      return (
        <span className="font-mono text-sm font-bold text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
          #{rank}
        </span>
      );
    }
    switch (rank) {
      case 1:
        return (
          <div className="flex items-center justify-center gap-1 bg-amber-500 text-white font-mono font-bold text-xs px-2.5 py-1 rounded-full shadow-sm shadow-amber-300">
            <Trophy className="w-3.5 h-3.5 shrink-0" /> Vàng
          </div>
        );
      case 2:
        return (
          <div className="flex items-center justify-center gap-1 bg-slate-300 text-slate-800 font-mono font-bold text-xs px-2.5 py-1 rounded-full shadow-sm">
            <Medal className="w-3.5 h-3.5 text-slate-700 shrink-0" /> Bạc
          </div>
        );
      case 3:
        return (
          <div className="flex items-center justify-center gap-1 bg-amber-100 text-amber-900 font-mono font-bold text-xs px-2.5 py-1 rounded-full shadow-sm border border-amber-200">
            <Award className="w-3.5 h-3.5 text-amber-800 shrink-0" /> Đồng
          </div>
        );
      default:
        return (
          <span className="font-mono text-sm font-bold text-gray-550 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            #{rank}
          </span>
        );
    }
  };

  const getStatusBadge = (athlete: any) => {
    if (athlete.status === "Bỏ thi") {
      return (
        <span className="font-mono text-[10px] font-extrabold text-rose-605 bg-rose-50 dark:bg-rose-950/30 px-2 py-1 rounded border border-rose-200 uppercase whitespace-nowrap">
          Bỏ thi
        </span>
      );
    }
    if (athlete.isSoloPending) {
      return (
        <span className="font-mono text-[9px] font-extrabold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 px-1.5 py-0.5 rounded border border-indigo-200 uppercase whitespace-nowrap animate-pulse">
          SOLO
        </span>
      );
    }
    if (athlete.isResoloPending) {
      return (
        <span className="font-mono text-[9px] font-extrabold text-amber-600 bg-amber-50 dark:bg-amber-955/25 px-1.5 py-0.5 rounded border border-amber-200 uppercase whitespace-nowrap animate-pulse">
          SOLO LẠI
        </span>
      );
    }
    if (selectedRoundTab === "all") {
      if (athlete.eliminatedInRoundIdx !== null && athlete.eliminatedInRoundIdx !== undefined) {
        return (
          <span className="font-mono text-[9px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 px-1.5 py-0.5 rounded whitespace-nowrap uppercase" title={`Bị loại lúc kết thúc Vòng ${athlete.eliminatedInRoundIdx + 1}`}>
            Loại V.{athlete.eliminatedInRoundIdx + 1}
          </span>
        );
      }
      if (athlete.isUnshot) {
        return (
          <span className="font-mono text-[9px] font-extrabold text-slate-500 bg-slate-50 dark:bg-slate-900/40 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800 uppercase whitespace-nowrap">
            Chưa bắn
          </span>
        );
      }
    } else {
      if (athlete.wasEliminatedEarlier) {
        return (
          <span className="font-mono text-[9px] font-extrabold text-red-500 bg-red-50 dark:bg-red-950/25 px-1.5 py-0.5 rounded border border-red-200 uppercase whitespace-nowrap">
            Đã bị loại
          </span>
        );
      }
      if (athlete.isUnshot) {
        return (
          <span className="font-mono text-[9px] font-extrabold text-slate-500 bg-slate-50 dark:bg-slate-900/40 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800 uppercase whitespace-nowrap">
            Chưa bắn
          </span>
        );
      }
      if (athlete.isEliminatedThisRound) {
        return (
          <span className="font-mono text-[9px] font-extrabold text-amber-600 bg-amber-50 dark:bg-amber-955/25 px-1.5 py-0.5 rounded border border-amber-200 uppercase whitespace-nowrap">
            Bị loại V. này
          </span>
        );
      }
    }

    let isCompletedInRound = false;
    if (selectedRoundTab !== "all") {
      const currentRoundDist = distances[selectedRoundTab];
      const rScores = currentRoundDist ? athlete.scores[currentRoundDist.id] : undefined;
      isCompletedInRound = !!rScores && rScores.length === shotsCount && rScores.every((val: any) => val !== null && val !== undefined);
    } else {
      let activeRoundIdx = 0;
      for (let r = 0; r < distances.length; r++) {
        const dist = distances[r];
        const hasScores = activeAthletes.some((a) => {
          const s = a.scores[dist.id];
          return s && s.some((v: any) => v !== null && v !== undefined);
        });
        if (hasScores) {
          activeRoundIdx = r;
        }
      }
      const activeRoundDist = distances[activeRoundIdx];
      const rScores = activeRoundDist ? athlete.scores[activeRoundDist.id] : undefined;
      isCompletedInRound = !!rScores && rScores.length === shotsCount && rScores.every((val: any) => val !== null && val !== undefined);
    }

    if (isCompletedInRound) {
      return (
        <span className="font-mono text-[9px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/20 px-1.5 py-0.5 rounded border border-blue-200 uppercase whitespace-nowrap">
          Đã bắn
        </span>
      );
    }

    return (
      <span className="font-mono text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-200 uppercase whitespace-nowrap">
        Đang đấu
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="w-5.5 h-5.5 text-amber-500" />
            Bảng Xếp Hạng Thực Tế (Live Leaderboard)
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Xếp hạng dựa trên {selectedRoundTab === "all" ? "Tổng Điểm giải đấu" : "Điểm Vòng đấu"}, ưu tiên tỉ lệ trúng mục tiêu làm chỉ số phụ.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Checkbox Top X */}
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg text-xs sm:text-sm font-bold text-amber-800 transition-colors">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showTopXOnly}
                onChange={(e) => setShowTopXOnly(e.target.checked)}
                className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
              />
              <span>Chỉ hiện TOP</span>
            </label>
            <input
              type="number"
              min={1}
              value={topXLimit}
              disabled={!showTopXOnly}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setTopXLimit(isNaN(val) ? 10 : Math.max(1, val));
              }}
              className="w-12 text-center h-7 text-xs bg-white disabled:bg-amber-100/50 disabled:text-amber-600 border border-amber-300 rounded font-black focus:outline-none focus:ring-1 focus:ring-amber-500 text-amber-900"
            />
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm VĐV, Câu lạc bộ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 w-full sm:w-[220px] text-sm bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* Team Filter */}
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-300 rounded-lg px-2 py-1 flex-1 sm:flex-initial">
            <Building className="w-4 h-4 text-gray-400" />
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="bg-transparent text-sm focus:outline-none text-gray-700 min-w-[120px]"
            >
              <option value="all">Tất cả Câu Lạc Bộ</option>
              {uniqueTeams.map((team, index) => (
                <option key={index} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Round/Vòng đấu Tabs Selector */}
      <div className="flex items-center gap-1.5 border-b border-gray-150 dark:border-slate-800 pb-2.5 mb-5 overflow-x-auto select-none">
        <button
          onClick={() => setSelectedRoundTab("all")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            selectedRoundTab === "all"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
          }`}
        >
          🏆 Tổng hợp giải đấu
        </button>
        {distances.map((dist, idx) => (
          <button
            key={dist.id}
            onClick={() => setSelectedRoundTab(idx)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              selectedRoundTab === idx
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
            }`}
          >
            🎯 Vòng {idx + 1} ({dist.distance})
            {dist.isElimination && (
              <span className="bg-amber-400 text-amber-950 font-black text-[8px] px-1 rounded-sm shrink-0">Cut</span>
            )}
          </button>
        ))}
      </div>

      {/* Round Configuration Details */}
      {selectedRoundTab === "all" ? (
        <div className="bg-blue-50/40 dark:bg-slate-900/30 border border-blue-150 rounded-xl p-3 mb-5 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
          <Info className="w-4.5 h-4.5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold mb-0.5">Thông tin cấu hình: Tổng hợp giải đấu</div>
            <div className="text-gray-500 dark:text-gray-400 leading-relaxed font-semibold">
              Xếp hạng dựa trên toàn bộ quá trình thi đấu của giải. Tổng điểm tích lũy của vận động viên qua tất cả các vòng đấu, ưu tiên tỉ lệ bắn trúng mục tiêu (%). Trong trường hợp bằng điểm và bằng tỉ lệ trúng, hệ thống sẽ tự động đối chiếu các chỉ số phụ của vòng đấu cuối cùng.
            </div>
          </div>
        </div>
      ) : (
        (() => {
          const dist = distances[selectedRoundTab];
          if (!dist) return null;
          return (
            <div className="bg-indigo-50/40 dark:bg-slate-900/30 border border-indigo-150 rounded-xl p-3 mb-5 text-xs text-indigo-900 dark:text-indigo-200 flex flex-col gap-2">
              <div className="flex items-start gap-2.5">
                <Info className="w-4.5 h-4.5 text-indigo-500 shrink-0 mt-0.5" />
                <div className="w-full">
                  <div className="font-bold mb-1">Cấu hình luật thi đấu: Vòng {selectedRoundTab + 1} ({dist.distance})</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-slate-650 dark:text-slate-300 mt-1.5">
                    <div className="bg-white/60 dark:bg-slate-900/40 px-2.5 py-1.5 rounded border border-indigo-100/60 flex flex-col">
                      <span className="text-[10px] text-indigo-500 uppercase tracking-wider font-bold">Cự ly bắn</span>
                      <span className="font-extrabold text-sm text-slate-850 dark:text-white">{dist.distance}</span>
                    </div>
                    <div className="bg-white/60 dark:bg-slate-900/40 px-2.5 py-1.5 rounded border border-indigo-100/60 flex flex-col">
                      <span className="text-[10px] text-indigo-500 uppercase tracking-wider font-bold">Điểm số mỗi lượt trúng</span>
                      <span className="font-extrabold text-sm text-slate-850 dark:text-white">x{dist.multiplier} điểm</span>
                    </div>
                    <div className="bg-white/60 dark:bg-slate-900/40 px-2.5 py-1.5 rounded border border-indigo-100/60 flex flex-col">
                      <span className="text-[10px] text-indigo-500 uppercase tracking-wider font-bold">Cách thức tính điểm</span>
                      <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200">
                        {dist.isCumulative ? "Cộng dồn với các vòng trước" : "Tính độc lập theo vòng này"}
                      </span>
                    </div>
                    <div className="bg-white/60 dark:bg-slate-900/40 px-2.5 py-1.5 rounded border border-indigo-100/60 flex flex-col">
                      <span className="text-[10px] text-indigo-500 uppercase tracking-wider font-bold">Quy tắc loại trực tiếp</span>
                      <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200">
                        {dist.isElimination ? (
                          <span className="text-amber-600 dark:text-amber-400 font-extrabold">
                            Giữ lại Top {dist.eliminationType === "percent" ? `${dist.eliminationValue}%` : `${dist.eliminationValue} VĐV`}
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">Không loại (Tất cả đi tiếp)</span>
                        )}
                      </span>
                    </div>
                  </div>
                  {dist.isElimination && (
                    <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-450 font-medium flex items-center gap-1 bg-amber-50/60 dark:bg-amber-950/20 px-2.5 py-1 rounded border border-amber-100/40">
                      ⚠️ <strong>Lưu ý loại trực tiếp:</strong> Vận động viên có thứ hạng thấp hơn ngưỡng loại sau vòng này sẽ dừng bước tại các vòng tiếp theo. {dist.isSolo && "Trong trường hợp bằng điểm tại ranh giới loại, VĐV sẽ phân định bằng Đấu súng Solo."}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()
      )}

      {sortedAthletes.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
          Chưa tìm thấy vận động viên nào thỏa mãn bộ lọc.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 animate-fadeIn">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-gray-100/80 border-b border-gray-200 text-gray-700 font-semibold select-none">
                <th className="p-3 w-[100px] text-center cursor-pointer hover:bg-gray-200/50" onClick={() => handleSort("rank")}>
                  <div className="flex items-center justify-center gap-1">
                    Thứ hạng <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="p-3 cursor-pointer hover:bg-gray-200/50" onClick={() => handleSort("name")}>
                  <div className="flex items-center gap-1">
                    Vận động viên <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="p-3 cursor-pointer hover:bg-gray-200/50" onClick={() => handleSort("team")}>
                  <div className="flex items-center gap-1">
                    Đội / Đơn vị <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                {competitionMode === "team" && (
                  <th className="p-3 text-center cursor-pointer hover:bg-gray-200/50 bg-indigo-50/50 text-indigo-900 font-bold" onClick={() => handleSort("teamScore")}>
                    <div className="flex items-center justify-center gap-1">
                      Tổng điểm đội <ArrowUpDown className="w-3.5 h-3.5" />
                    </div>
                  </th>
                )}
                <th className="p-3 text-center font-bold text-blue-800 bg-blue-50/50 w-[120px]">Điểm số</th>
                <th className="p-3 text-center w-[130px]">Trạng thái</th>
                <th className="p-3 text-center">{isPointModeActive ? "Chi tiết cự ly (Điểm / Tối đa)" : "Chi tiết cự ly (Trúng / Lượt)"}</th>
                <th className="p-3 text-center cursor-pointer hover:bg-gray-200/50" onClick={() => handleSort("accuracy")}>
                  <div className="flex items-center justify-center gap-1">
                    {isPointModeActive ? "Hiệu suất điểm" : "Tỉ lệ trúng"} <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
               {sortedAthletes.map((athlete, index) => {
                const rank = athlete.baseRank;
                const teamName = athlete.team ? athlete.team.trim() : "Không Có";
                const teamNameNormalized = teamName === "" ? "VĐV Tự Do (Không Đội)" : teamName;
                const teamScore = activeTeamScores[teamNameNormalized] || 0;

                const hasScore = competitionMode === "team"
                  ? teamScore > 0
                  : (athlete.totalScore > 0 || athlete.wasEliminatedEarlier);

                const isEliminatedCumulatively = selectedRoundTab === "all" && athlete.eliminatedInRoundIdx !== null;
                const isTop1 = rank === 1 && hasScore;
                const isTop2 = rank === 2 && hasScore;
                const isTop3 = rank === 3 && hasScore;
                
                // Row and border styling
                let rowBgClass = "hover:bg-gray-50/80 transition-all dark:hover:bg-slate-850/30";
                let rowBorderClass = "border-b border-gray-100 dark:border-slate-800";
                let rowTopBorderClass = "border-t border-gray-100 dark:border-slate-800";
                let cellPaddingClass = "p-3";
                let nameFontClass = "font-bold text-slate-950 text-sm dark:text-slate-100";
                let scoreBgClass = "p-3 text-center font-mono text-lg font-extrabold text-blue-700 bg-blue-50/20";
                
                const isDimmed = selectedRoundTab !== "all" && (athlete.wasEliminatedEarlier || isEliminatedCumulatively) && !isTop1 && !isTop2 && !isTop3;

                if (isTop1) {
                  rowBgClass = "bg-amber-500/[0.04] transition-all bg-gradient-to-r from-amber-500/[0.015] to-transparent hover:bg-amber-500/[0.07]";
                  rowBorderClass = "border-b border-amber-500/20";
                  rowTopBorderClass = "border-t border-amber-500/20";
                  cellPaddingClass = "p-4.5 sm:py-5 sm:px-4";
                  nameFontClass = "font-black text-amber-950 text-base leading-tight tracking-tight dark:text-amber-200";
                  scoreBgClass = "p-4.5 sm:py-5 sm:px-4 text-center font-mono text-xl font-black text-amber-700 bg-amber-500/10 border-l border-amber-500/10";
                } else if (isTop2) {
                  rowBgClass = "bg-slate-400/[0.04] transition-all bg-gradient-to-r from-slate-400/[0.015] to-transparent hover:bg-slate-400/[0.07]";
                  rowBorderClass = "border-b border-slate-400/20";
                  rowTopBorderClass = "border-t border-slate-400/20";
                  cellPaddingClass = "p-4 sm:py-4.5 sm:px-4";
                  nameFontClass = "font-extrabold text-slate-800 text-[15px] leading-tight dark:text-slate-200";
                  scoreBgClass = "p-4 sm:py-4.5 sm:px-4 text-center font-mono text-lg font-black text-slate-700 bg-slate-400/10 border-l border-slate-400/15";
                } else if (isTop3) {
                  rowBgClass = "bg-amber-700/[0.04] transition-all bg-gradient-to-r from-amber-700/[0.015] to-transparent hover:bg-amber-700/[0.07]";
                  rowBorderClass = "border-b border-amber-600/20";
                  rowTopBorderClass = "border-t border-amber-600/20";
                  cellPaddingClass = "p-3.5 sm:py-3.5 sm:px-4";
                  nameFontClass = "font-bold text-amber-900 text-sm leading-tight dark:text-amber-300";
                  scoreBgClass = "p-3.5 sm:py-3.5 sm:px-4 text-center font-mono text-[17px] font-bold text-amber-800 bg-amber-700/10 border-l border-amber-600/10";
                } else if (isDimmed) {
                  rowBgClass = "bg-gray-50/40 dark:bg-slate-950/20 opacity-60 text-gray-400";
                  rowBorderClass = "border-b border-gray-100 dark:border-slate-800";
                  rowTopBorderClass = "border-t border-gray-100 dark:border-slate-800";
                } else if (selectedRoundTab !== "all" && athlete.isEliminatedThisRound && !athlete.isResoloPending) {
                  rowBgClass = "bg-rose-50/[0.15] dark:bg-rose-950/10 text-gray-500 hover:bg-rose-50/[0.25]";
                  rowBorderClass = "border-b border-rose-100";
                  rowTopBorderClass = "border-t border-rose-100";
                  nameFontClass = "font-semibold text-rose-950 text-sm dark:text-rose-300";
                  scoreBgClass = "p-3 text-center font-mono text-lg font-extrabold text-rose-700 bg-rose-50/10";
                }

                // Determine row span variables for Team Competition Mode
                let isFirstOfTeam = true;
                let teamRowSpan = 1;
                
                if (competitionMode === "team") {
                  if (index > 0 && (sortedAthletes[index - 1].team?.trim() || "Không Có") === teamName) {
                    isFirstOfTeam = false;
                  } else {
                    let tempIndex = index + 1;
                    while (tempIndex < sortedAthletes.length && (sortedAthletes[tempIndex].team?.trim() || "Không Có") === teamName) {
                      teamRowSpan++;
                      tempIndex++;
                    }
                  }
                }

                // If in team mode and NOT the last athlete of their team block, do not draw a bottom border to prevent separating lines inside spanned/merged cells
                let isLastOfTeam = true;
                if (competitionMode === "team") {
                  if (index + 1 < sortedAthletes.length && (sortedAthletes[index + 1].team?.trim() || "Không Có") === teamName) {
                    isLastOfTeam = false;
                  }
                }

                // Split border handling to align with user styling request:
                // If in team mode and NOT the last of their team block, there should be NO bottom borders (border-b-0) on all cells
                // in order to avoid drawing browser-collapsed horizontal lines across spanned cells.
                // This cleanly fuses teammates into a single solid team block.
                // The outer boundaries of the team block are drawn correctly by using rowBorderClass on spanned cells and the last teammate's cells.
                let mergedCellBorderClass = rowBorderClass;
                let individualCellBorderClass = rowBorderClass;

                if (competitionMode === "team") {
                  if (!isLastOfTeam) {
                    mergedCellBorderClass = rowBorderClass;
                    individualCellBorderClass = "border-b-transparent";
                  }
                }

                // Determine styling and font size for "Tổng điểm đội", color-coded by team's rank (isTop1, isTop2, isTop3)
                let teamScoreCellClass = "text-center align-middle font-mono font-black text-lg text-indigo-750 bg-indigo-50/20";
                if (isTop1) {
                  teamScoreCellClass = "text-center align-middle font-mono font-black text-[23px] sm:text-[25px] text-amber-800 dark:text-amber-200 bg-amber-500/[0.12]";
                } else if (isTop2) {
                  teamScoreCellClass = "text-center align-middle font-mono font-black text-[21px] sm:text-[23px] text-slate-800 dark:text-slate-200 bg-slate-400/[0.12]";
                } else if (isTop3) {
                  teamScoreCellClass = "text-center align-middle font-mono font-black text-[20px] sm:text-[22px] text-amber-700 dark:text-amber-300 bg-amber-700/[0.12]";
                }

                return (
                  <tr 
                    key={`lb-ath-${athlete.id || "ath"}-${index}`} 
                    className={rowBgClass}
                  >
                    {/* Position medal / rank */}
                    {(!competitionMode || competitionMode !== "team" || isFirstOfTeam) && (
                      <td 
                        className={`${cellPaddingClass} text-center align-middle ${mergedCellBorderClass}`}
                        rowSpan={competitionMode === "team" ? teamRowSpan : undefined}
                      >
                        <div className="flex justify-center">
                          {getOnlyRankBadge(athlete.baseRank, hasScore, athlete)}
                        </div>
                      </td>
                    )}

                    {/* Name with Avatar on the Left (Right of third column rank) */}
                    <td className={`${cellPaddingClass} ${individualCellBorderClass}`}>
                      <div className="flex items-center gap-3">
                        <img 
                          src={athlete.avatarUrl || AVATAR_MALE} 
                          alt={athlete.name} 
                          className={`rounded-full object-cover border shadow-sm shrink-0 ${
                            isTop1 
                              ? "w-11 h-11 border-amber-300 ring-2 ring-amber-200" 
                              : isTop2 
                                ? "w-10 h-10 border-slate-300 ring-1 ring-slate-200"
                                : isTop3
                                  ? "w-9.5 h-9.5 border-amber-500/30 ring-1 ring-amber-100/50"
                                  : "w-9 h-9 border-slate-200"
                          }`}
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={nameFontClass}>{athlete.name}</span>
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5">Mã số: {athlete.id}</div>
                        </div>
                      </div>
                    </td>
  
                    {/* Team */}
                    {(!competitionMode || competitionMode !== "team" || isFirstOfTeam) && (
                      <td 
                        className={`${cellPaddingClass} align-middle ${mergedCellBorderClass}`}
                        rowSpan={competitionMode === "team" ? teamRowSpan : undefined}
                      >
                      {athlete.team ? (
                        <span className={`text-[13px] sm:text-xs md:text-sm font-bold px-2.5 py-1.5 rounded-md border inline-block select-none shadow-sm/5 transition-all ${
                          isTop1 
                            ? "bg-amber-500/[0.08] text-amber-900 border-amber-500/25 dark:text-amber-200"
                            : isTop2
                              ? "bg-slate-400/[0.08] text-slate-800 border-slate-400/25 dark:text-slate-200"
                              : isTop3
                                ? "bg-amber-700/[0.08] text-amber-800 border-amber-600/25 dark:text-amber-300"
                                : "bg-blue-50/80 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40"
                        }`}>
                          {athlete.team}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-xs">Không có</span>
                      )}
                      </td>
                    )}

                    {competitionMode === "team" && isFirstOfTeam && (
                      <td 
                        className={`${cellPaddingClass} ${teamScoreCellClass} ${mergedCellBorderClass}`}
                        rowSpan={teamRowSpan}
                      >
                        {(() => {
                          const tName = athlete.team.trim() === "" ? "VĐV Tự Do (Không Đội)" : athlete.team.trim();
                          const val = activeTeamScores[tName] || 0;
                          return (
                            <span className="flex items-center justify-center gap-1">
                              <span>{Math.floor(val)}</span>
                              <span className="text-xs font-semibold opacity-70">đ</span>
                            </span>
                          );
                        })()}
                      </td>
                    )}

                    {/* Big Total score */}
                    <td className={`${scoreBgClass} ${individualCellBorderClass}`}>
                      {athlete.wasEliminatedEarlier ? "-" : athlete.totalScore}
                    </td>

                    {/* Status Badge */}
                    <td className={`${cellPaddingClass} text-center ${individualCellBorderClass}`}>
                      <div className="flex justify-center">
                        {getStatusBadge(athlete)}
                      </div>
                    </td>
  
                    {/* Detailed points per distance */}
                    <td className={`${cellPaddingClass} ${individualCellBorderClass}`}>
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {(() => {
                          const shotQualifiedRows = athlete.breakdown.filter((row) => {
                            if (!row.isQualified) return false;
                            const rScores = athlete.scores[row.distanceId];
                            const wasNormalShot = rScores && rScores.length > 0 && rScores.some((val: any) => val !== null && val !== undefined);
                            const wasSoloShot = (() => {
                              const sRounds = athlete.soloRounds?.[row.distanceId];
                              if (sRounds && sRounds.length > 0 && sRounds.some((v: any) => v !== null && v !== undefined)) return true;
                              const sHit = athlete.soloHits?.[row.distanceId];
                              return sHit !== undefined && sHit !== null;
                            })();
                            return (wasNormalShot || wasSoloShot);
                          });

                          const firstUnqualifiedRow = athlete.breakdown.find(row => !row.isQualified);
                          const shownBreakdown = [...shotQualifiedRows];
                          if (firstUnqualifiedRow) {
                            shownBreakdown.push(firstUnqualifiedRow);
                          }

                          if (shownBreakdown.length === 0) {
                            return (
                              <span className="text-gray-400 dark:text-slate-500 italic text-xs py-0.5 select-none font-medium">
                                chưa có dữ liệu
                              </span>
                            );
                          }

                          return shownBreakdown.map((row, index) => {
                            const distConfig = distances.find(d => d.id === row.distanceId) || distances.find(d => d.distance === row.distanceName);
                            const rIdx = distConfig ? distances.findIndex(d => d.id === distConfig.id) : -1;
                            const vPrefix = rIdx !== -1 ? `V${rIdx + 1} - ` : "";
                            const soloVal = distConfig && athlete.soloHits?.[distConfig.id];
                            return (
                              <div 
                                key={row.distanceId || row.distanceName || index}
                                className={`text-xs px-2 py-1 rounded flex items-center gap-1.5 font-mono shadow-sm border ${
                                  !row.isQualified 
                                    ? "bg-red-50 text-red-500 border-red-200 line-through opacity-70"
                                    : isTop1
                                      ? "bg-amber-500/[0.02] text-amber-900 border-amber-300/30"
                                      : "bg-slate-100 text-slate-850 border-transparent text-gray-700 bg-gray-100"
                                }`}
                                title={!row.isQualified ? "Bị loại, không có quyền tham gia cự ly này" : `Hệ số: x${row.multiplier}`}
                              >
                                <span className="font-semibold text-gray-650 font-sans">{vPrefix}{row.distanceName}:</span>
                                {!row.isQualified ? (
                                  <span className="text-[10px] font-bold uppercase text-red-500">Out</span>
                                ) : (
                                  <>
                                    <span className="font-bold text-indigo-700">{row.hitCount}</span>
                                    <span className="text-gray-400">/</span>
                                    <span className="text-gray-500">{row.maxHits}{isPointModeActive ? "đ" : "v"}</span>
                                    <span className="bg-indigo-50 px-1 rounded text-[10px] font-bold text-indigo-600">
                                      +{row.score}đ
                                    </span>
                                    {(() => {
                                      if (!distConfig || !distConfig.isSolo) {
                                        return null;
                                      }
                                      const hasSoloValue = athlete.soloHits?.[distConfig.id] !== undefined && athlete.soloHits?.[distConfig.id] !== null;
                                      if (!hasSoloValue) {
                                        return null;
                                      }
                                      const rounds = athlete.soloRounds?.[distConfig.id];
                                      if (rounds && rounds.length > 0) {
                                        return rounds.map((rVal, idx) => {
                                          const displayVal = rVal === null || rVal === undefined ? "-" : rVal;
                                          return (
                                            <span 
                                              key={idx} 
                                              className="bg-purple-100 text-purple-700 px-1 py-0.5 rounded text-[9px] font-black border border-purple-200 whitespace-nowrap" 
                                              title={`Điểm Solo Lần ${idx + 1}`}
                                            >
                                              🎯S{idx + 1}:{displayVal}
                                            </span>
                                          );
                                        });
                                      } else if (soloVal !== undefined && soloVal !== null) {
                                        return (
                                          <span 
                                            className="bg-purple-100 text-purple-700 px-1 py-0.5 rounded text-[9px] font-black border border-purple-200 whitespace-nowrap" 
                                            title="Điểm Solo Shootout"
                                          >
                                            🎯S:{soloVal}
                                          </span>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </td>
  
                    {/* Total accuracy */}
                    <td className={`${cellPaddingClass} font-mono text-center ${individualCellBorderClass}`}>
                      {athlete.wasEliminatedEarlier ? (
                        <div className="font-bold text-gray-400 font-mono text-sm">-</div>
                      ) : (
                        <>
                          <div className="font-bold text-gray-800 text-xs sm:text-sm">
                            {athlete.totalHits}/{athlete.totalPossibleShots} {isPointModeActive ? "điểm" : "viên"}
                          </div>
                          <div className="text-xs text-emerald-600 font-bold">
                            {athlete.accuracy.toFixed(1)}%
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
