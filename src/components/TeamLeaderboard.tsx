import React, { useMemo, useState } from "react";
import { Athlete, DistanceConfig } from "../types";
import { Users, Award, Shield, Trophy, Medal } from "lucide-react";
import { calculateRounds, getHitCount } from "../utils/qualification";

interface TeamLeaderboardProps {
  athletes: Athlete[];
  distances: DistanceConfig[];
  shotsCount: number;
  competitionMode?: "individual" | "team";
  directMaxShots?: number;
  teamDirectMaxShots?: number;
  directMaxPoints?: number;
  teamDirectMaxPoints?: number;
  language?: "vi" | "en";
}

interface TeamMemberData {
  id: string;
  name: string;
  totalScore: number;
  totalHits: number;
  totalShots: number;
  accuracy: number;
}

interface TeamData {
  teamName: string;
  totalScore: number;
  totalHits: number;
  totalShots: number;
  averageAccuracy: number;
  memberCount: number;
  members: TeamMemberData[];
  survivalVal: number;
}

export const TeamLeaderboard: React.FC<TeamLeaderboardProps> = ({ 
  athletes, 
  distances, 
  shotsCount,
  competitionMode = "individual",
  directMaxShots,
  teamDirectMaxShots,
  directMaxPoints,
  teamDirectMaxPoints,
  language = "vi",
}) => {
  const [activeTab, setActiveTab] = useState<"survival" | "allRound">("survival");

  const isDirectMode = shotsCount === 1;

  const effectiveShotsCount = isDirectMode
    ? (competitionMode === "team" ? (teamDirectMaxShots || 10) : (directMaxShots || 10))
    : shotsCount;

  const effectiveDirectMaxPoints = competitionMode === "team" ? teamDirectMaxPoints : directMaxPoints;
  const isPointModeActive = isDirectMode && effectiveDirectMaxPoints !== undefined && effectiveDirectMaxPoints > 0;

  // In team mode, only include those who are primary team players (bắn chính)
  const activeAthletes = useMemo(() => {
    return athletes.filter((a) => a.isPrimaryTeam);
  }, [athletes]);

  // Determine which athletes are included under the active conditions
  const activeAthletesForCalculation = useMemo(() => {
    if (competitionMode === "team") {
      // In team mode, only include primary team players (bắn chính)
      return athletes.filter((a) => a.isPrimaryTeam);
    } else {
      // In individual mode:
      if (activeTab === "survival") {
        // "Team Bắn Chính" -> only include primary team players (bắn chính)
        return athletes.filter((a) => a.isPrimaryTeam);
      } else {
        // "500 Anh Em" -> include all athletes (both primary and backup/reserve)
        return athletes;
      }
    }
  }, [athletes, competitionMode, activeTab]);

  // Compute qualifications and rounds results using the direct, consistent utils helper
  const roundResults = useMemo(() => {
    const effectiveDirectMaxPoints = competitionMode === "team" ? teamDirectMaxPoints : directMaxPoints;
    return calculateRounds(activeAthletes, distances, effectiveShotsCount, effectiveDirectMaxPoints);
  }, [activeAthletes, distances, effectiveShotsCount, competitionMode, directMaxPoints, teamDirectMaxPoints]);

  // Group and compute round-by-round team progression in team competition mode
  const teamRoundResults = useMemo(() => {
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
        let totalPossPoints = 0;
        let totalPossShots = 0;

        activeMembers.forEach((memb) => {
          if (dist.isCumulative) {
            for (let i = 0; i <= r; i++) {
              const distI = distances[i];
              const wasShot = memb.scores[distI.id] && memb.scores[distI.id].length > 0 && memb.scores[distI.id].some(v => v !== null && v !== undefined);
              if (wasShot) {
                if (isDirectMode && teamDirectMaxPoints !== undefined && teamDirectMaxPoints > 0) {
                  totalPossPoints += teamDirectMaxPoints * distI.multiplier;
                } else {
                  totalPossShots += effectiveShotsCount;
                }
              }
            }
          } else {
            const wasShot = memb.scores[dist.id] && memb.scores[dist.id].length > 0 && memb.scores[dist.id].some(v => v !== null && v !== undefined);
            if (wasShot) {
              if (isDirectMode && teamDirectMaxPoints !== undefined && teamDirectMaxPoints > 0) {
                totalPossPoints += teamDirectMaxPoints * dist.multiplier;
              } else {
                totalPossShots += effectiveShotsCount;
              }
            } else {
              if (isDirectMode && teamDirectMaxPoints !== undefined && teamDirectMaxPoints > 0) {
                totalPossPoints += teamDirectMaxPoints * dist.multiplier;
              } else {
                totalPossShots += effectiveShotsCount;
              }
            }
          }
        });

        if (isDirectMode && teamDirectMaxPoints !== undefined && teamDirectMaxPoints > 0) {
          if (totalPossPoints === 0) {
            totalPossPoints = activeMembers.length * teamDirectMaxPoints * dist.multiplier;
          }
          accuracy = totalPossPoints > 0 ? (displayScore / totalPossPoints) * 100 : 0;
        } else {
          if (totalPossShots === 0) {
            const totalShotsCountInRounds = dist.isCumulative ? (r + 1) * effectiveShotsCount : effectiveShotsCount;
            totalPossShots = activeMembers.length * totalShotsCountInRounds;
          }
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
  }, [activeAthletes, distances, shotsCount]);

  // Map survival stats to each athlete based on team-level round results
  const athleteSurvivalMap = useMemo(() => {
    const map: Record<string, {
      eliminatedInRoundIdx: number | null;
      survivalVal: number;
      survivalScore: number;
      survivalHits: number;
      survivalShots?: number;
      survivalAccuracy: number;
    }> = {};

    const hasMaxRoundScoreConf = distances.some(d => d.isMaxRoundScore);

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

      const survivalVal = eliminatedInRoundIdx === null ? distances.length : eliminatedInRoundIdx;
      const lastActiveRoundIdx = eliminatedInRoundIdx === null ? (distances.length - 1) : eliminatedInRoundIdx;

      let survivalScore = 0;
      let survivalHits = 0;
      let survivalAccuracy = 0;

      if (distances.length > 0 && lastActiveRoundIdx >= 0) {
        if (hasMaxRoundScoreConf) {
          let maxScore = -1;
          let maxHits = 0;
          let maxAccuracy = 0;

          let cumulativeHitsSumInShotRounds = 0;
          let cumulativeScoreSumInShotRounds = 0;
          let cumulativeMultiplierSumInShotRounds = 0;
          let cumulativeCountInShotRounds = 0;

          for (let i = 0; i <= lastActiveRoundIdx; i++) {
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
            if (cumulativeMultiplierSumInShotRounds === 0 && distances[lastActiveRoundIdx]) {
              cumulativeMultiplierSumInShotRounds = distances[lastActiveRoundIdx].multiplier;
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
          map[athlete.id] = {
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
                totalMultiplier += distances[i].multiplier;
              }
              const totalPossPoints = effectiveDirectMaxPoints * totalMultiplier;
              calculatedPossShots = totalPossPoints;
              survivalAccuracy = totalPossPoints > 0 ? (survivalScore / totalPossPoints) * 100 : 0;
            } else {
              const totalPossShots = (lastActiveRoundIdx + 1) * effectiveShotsCount;
              calculatedPossShots = totalPossShots;
              survivalAccuracy = totalPossShots > 0 ? (survivalHits / totalPossShots) * 100 : 0;
            }
            map[athlete.id] = {
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

    return map;
  }, [activeAthletes, distances, teamRoundResults, roundResults, shotsCount]);

  // Compute active team scores exactly like in Leaderboard.tsx (cumulative up to qualified round, with solo factor)
  const activeTeamScores = useMemo(() => {
    const scores: Record<string, number> = {};
    const hasMaxRoundScoreConf = distances.some(d => d.isMaxRoundScore);

    if (hasMaxRoundScoreConf) {
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
      activeAthletes.forEach((athlete) => {
        const rawTeam = athlete.team.trim();
        const teamName = rawTeam === "" ? "VĐV Tự Do (Không Đội)" : rawTeam;

        let personalScore = 0;
        let personalSolo = 0;
        distances.forEach((distance, rIdx) => {
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
  }, [activeAthletes, distances, teamRoundResults]);

  // Compute standard joint ranks for survival ("Trụ Lại Cuối Cùng")
  const teamRanks = useMemo(() => {
    const teamStats: Record<string, { survivalVal: number; score: number }> = {};
    activeAthletes.forEach((ath) => {
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
        const sVal = eliminatedInRoundIdx === null ? distances.length : eliminatedInRoundIdx;
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
  }, [activeAthletes, teamRoundResults, activeTeamScores, distances.length]);

  // Compute standard joint ranks for "Toàn Giải" tab (simple team score descending)
  const teamRanksAllRound = useMemo(() => {
    const teamStats: Record<string, { score: number }> = {};

    activeAthletes.forEach((ath) => {
      const rawTeam = ath.team.trim();
      const teamName = rawTeam === "" ? "VĐV Tự Do (Không Đội)" : rawTeam;
      if (!teamStats[teamName]) {
        let totalScoreAll = 0;
        const members = activeAthletes.filter((a) => {
          const r = a.team.trim();
          const t = r === "" ? "VĐV Tự Do (Không Đội)" : r;
          return t === teamName && a.isPrimaryTeam && a.status !== "Bỏ thi";
        });

        members.forEach((memb) => {
          distances.forEach((dist) => {
            const hits = memb.scores[dist.id] || [];
            const hitCount = getHitCount(hits);
            totalScoreAll += hitCount * dist.multiplier;
          });
        });
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
  }, [activeAthletes, distances, teamRoundResults, competitionMode]);

  // Group and aggregate statistics by Team
  const teamLeaderboardData = useMemo(() => {
    const groups: Record<string, TeamMemberData[]> = {};
    const hasMaxRoundScoreConf = distances.some(d => d.isMaxRoundScore);

    activeAthletesForCalculation.forEach((athlete) => {
      const rawTeam = athlete.team.trim();
      const teamName = rawTeam === "" ? "VĐV Tự Do (Không Đội)" : rawTeam;

      let totalScore = 0;
      let totalHits = 0;
      let totalShots = 0;
      let accuracy = 0;

      if (competitionMode === "team") {
        if (hasMaxRoundScoreConf && activeTab !== "allRound") {
          if (activeTab === "allRound") {
            // Find max score of all rounds without elimination limit
            let maxScore = -1;
            let maxHits = 0;
            let maxAccuracy = 0;
            let maxRoundMultiplier = 1;

            let cumulativeHitsSumInShotRounds = 0;
            let cumulativeScoreSumInShotRounds = 0;
            let cumulativeMultiplierSumInShotRounds = 0;
            let cumulativeCountInShotRounds = 0;

            distances.forEach((dist, rIdx) => {
              const isQualified = rIdx === 0 || (teamRoundResults[rIdx]?.qualifiedTeams.includes(teamName));
              if (isQualified) {
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

                let accuracyLocal = 0;
                if (isPointModeActive && effectiveDirectMaxPoints !== undefined) {
                  const totalPossPoints = effectiveDirectMaxPoints * dist.multiplier;
                  accuracyLocal = totalPossPoints > 0 ? (score / totalPossPoints) * 100 : 0;
                } else {
                  accuracyLocal = effectiveShotsCount > 0 ? (hitCount / effectiveShotsCount) * 100 : 0;
                }
                if (score > maxScore) {
                  maxScore = score;
                  maxHits = hitCount;
                  maxAccuracy = accuracyLocal;
                  maxRoundMultiplier = dist.multiplier;
                }
              }
            });
            totalScore = maxScore >= 0 ? maxScore : 0;
            totalHits = cumulativeHitsSumInShotRounds;
            if (isPointModeActive && effectiveDirectMaxPoints !== undefined) {
              if (cumulativeMultiplierSumInShotRounds === 0 && distances[0]) {
                cumulativeMultiplierSumInShotRounds = distances[0].multiplier;
              }
              const totalPossPoints = effectiveDirectMaxPoints * cumulativeMultiplierSumInShotRounds;
              totalShots = totalPossPoints;
              accuracy = totalPossPoints > 0 ? (cumulativeScoreSumInShotRounds / totalPossPoints) * 100 : 0;
            } else {
              if (cumulativeCountInShotRounds === 0) {
                cumulativeCountInShotRounds = 1;
              }
              const totalPossShots = cumulativeCountInShotRounds * effectiveShotsCount;
              totalShots = totalPossShots;
              accuracy = totalPossShots > 0 ? (cumulativeHitsSumInShotRounds / totalPossShots) * 100 : 0;
            }
          } else {
            const survivalInfo = athleteSurvivalMap[athlete.id];
            if (survivalInfo) {
              totalScore = survivalInfo.survivalScore;
              totalHits = survivalInfo.survivalHits;
              totalShots = survivalInfo.survivalShots ?? 0;
              accuracy = survivalInfo.survivalAccuracy;
            }
          }
        } else {
          if (activeTab === "allRound") {
            // Complete cumulative stats (accumulate all rounds)
            distances.forEach((dist) => {
              const hits = athlete.scores[dist.id] || [];
              const hitCount = getHitCount(hits);
              const score = hitCount * dist.multiplier;
              totalScore += score;
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
            if (isPointModeActive && effectiveDirectMaxPoints !== undefined) {
              totalShots = effectiveDirectMaxPoints * totalMultiplierOfShotRounds;
              accuracy = totalShots > 0 ? (totalScore / totalShots) * 100 : 0;
            } else {
              totalShots = countShotRounds * effectiveShotsCount;
              accuracy = totalShots > 0 ? (totalHits / totalShots) * 100 : 0;
            }
          } else {
            // Survival stats (cumulative up to the team's elimination round)
            const survivalInfo = athleteSurvivalMap[athlete.id];
            if (survivalInfo) {
              totalScore = survivalInfo.survivalScore;
              totalHits = survivalInfo.survivalHits;
              const lastActiveRoundIdx = survivalInfo.eliminatedInRoundIdx === null ? (distances.length - 1) : survivalInfo.eliminatedInRoundIdx;
              let totalMultiplier = 0;
              let shotRoundsCount = 0;
              for (let i = 0; i <= lastActiveRoundIdx; i++) {
                const distI = distances[i];
                const wasShot = athlete.scores[distI.id] && athlete.scores[distI.id].length > 0 && athlete.scores[distI.id].some(v => v !== null && v !== undefined);
                if (wasShot) {
                  totalMultiplier += distI.multiplier;
                  shotRoundsCount++;
                }
              }
              if (shotRoundsCount === 0 && distances[lastActiveRoundIdx]) {
                totalMultiplier = distances[lastActiveRoundIdx].multiplier;
                shotRoundsCount = 1;
              }
              if (isPointModeActive && effectiveDirectMaxPoints !== undefined) {
                totalShots = effectiveDirectMaxPoints * totalMultiplier;
              } else {
                totalShots = shotRoundsCount * effectiveShotsCount;
              }
              accuracy = survivalInfo.survivalAccuracy;
            }
          }
        }
      } else {
        // Individual mode: simple cumulative stats across all rounds (no team elimination)
        if (hasMaxRoundScoreConf) {
          let maxScore = -1;
          let maxHits = 0;
          let maxAccuracy = 0;
          let maxRoundMultiplier = 1;

          let cumulativeHitsSumInShotRounds = 0;
          let cumulativeScoreSumInShotRounds = 0;
          let cumulativeMultiplierSumInShotRounds = 0;
          let cumulativeCountInShotRounds = 0;

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

            let accuracyLocal = 0;
            if (isPointModeActive && effectiveDirectMaxPoints !== undefined) {
              const totalPossPoints = effectiveDirectMaxPoints * dist.multiplier;
              accuracyLocal = totalPossPoints > 0 ? (score / totalPossPoints) * 100 : 0;
            } else {
              accuracyLocal = effectiveShotsCount > 0 ? (hitCount / effectiveShotsCount) * 100 : 0;
            }

            if (score > maxScore) {
              maxScore = score;
              maxHits = hitCount;
              maxAccuracy = accuracyLocal;
              maxRoundMultiplier = dist.multiplier;
            }
          });

          totalScore = maxScore >= 0 ? maxScore : 0;
          totalHits = cumulativeHitsSumInShotRounds;
          if (isPointModeActive && effectiveDirectMaxPoints !== undefined) {
            if (cumulativeMultiplierSumInShotRounds === 0 && distances[0]) {
              cumulativeMultiplierSumInShotRounds = distances[0].multiplier;
            }
            const totalPossPoints = effectiveDirectMaxPoints * cumulativeMultiplierSumInShotRounds;
            totalShots = totalPossPoints;
            accuracy = totalPossPoints > 0 ? (cumulativeScoreSumInShotRounds / totalPossPoints) * 100 : 0;
          } else {
            if (cumulativeCountInShotRounds === 0) {
              cumulativeCountInShotRounds = 1;
            }
            const totalPossShots = cumulativeCountInShotRounds * effectiveShotsCount;
            totalShots = totalPossShots;
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
          if (isPointModeActive && effectiveDirectMaxPoints !== undefined) {
            totalShots = effectiveDirectMaxPoints * totalMultiplierOfShotRounds;
            accuracy = totalShots > 0 ? (totalScore / totalShots) * 100 : 0;
          } else {
            totalShots = countShotRounds * effectiveShotsCount;
            accuracy = totalShots > 0 ? (totalHits / totalShots) * 100 : 0;
          }
        }
      }

      const member: TeamMemberData = {
        id: athlete.id,
        name: athlete.name,
        totalScore,
        totalHits,
        totalShots,
        accuracy,
      };

      if (!groups[teamName]) {
        groups[teamName] = [];
      }
      groups[teamName].push(member);
    });

    // Translate groups to TeamData array
    const teamsArray: TeamData[] = Object.entries(groups).map(([teamName, members]) => {
      const sortedMembers = [...members].sort((a, b) => b.totalScore - a.totalScore);
      
      let totalScore = members.reduce((sum, m) => sum + m.totalScore, 0);
      let totalHits = members.reduce((sum, m) => sum + m.totalHits, 0);
      let totalShots = members.reduce((sum, m) => sum + m.totalShots, 0);

      if (competitionMode === "team" && hasMaxRoundScoreConf && activeTab !== "allRound") {
        let teamScoreSum = 0;
        let teamHitsSum = 0;
        let teamShotsSum = 0;

        const activeMembers = activeAthletesForCalculation.filter((a) => {
          const raw = a.team.trim();
          const t = raw === "" ? "VĐV Tự Do (Không Đội)" : raw;
          return t === teamName && a.status !== "Bỏ thi";
        });

        activeMembers.forEach((memb) => {
          let memberMaxScore = -1;
          let memberHitsAtMax = 0;
          let memberShotsAtMax = 0;

          distances.forEach((dist, rIdx) => {
            const isQualified = activeTab === "allRound" || rIdx === 0 || (teamRoundResults[rIdx]?.qualifiedTeams.includes(teamName));
            if (isQualified) {
              const hits = memb.scores[dist.id] || [];
              const hitCount = getHitCount(hits);
              const score = hitCount * dist.multiplier;
              let shotsCountForDist = 0;

              if (isPointModeActive && effectiveDirectMaxPoints !== undefined) {
                shotsCountForDist = effectiveDirectMaxPoints * dist.multiplier;
              } else {
                shotsCountForDist = effectiveShotsCount;
              }

              if (score > memberMaxScore) {
                memberMaxScore = score;
                memberHitsAtMax = hitCount;
                memberShotsAtMax = shotsCountForDist;
              }
            }
          });

          teamScoreSum += memberMaxScore >= 0 ? memberMaxScore : 0;
          teamHitsSum += memberHitsAtMax;
          teamShotsSum += memberShotsAtMax;
        });

        totalScore = teamScoreSum;
        totalHits = members.reduce((sum, m) => sum + m.totalHits, 0);
        totalShots = members.reduce((sum, m) => sum + m.totalShots, 0);
      }

      const averageAccuracy = isPointModeActive && effectiveDirectMaxPoints !== undefined
        ? (totalShots > 0 ? (totalScore / totalShots) * 100 : 0)
        : (totalShots > 0 ? (totalHits / totalShots) * 100 : 0);

      // Determine the team's survival value
      let survivalVal = distances.length;
      if (competitionMode === "team") {
        for (let i = 0; i < teamRoundResults.length; i++) {
          if (teamRoundResults[i].eliminatedTeams.includes(teamName)) {
            survivalVal = i;
            break;
          }
        }
      }

      return {
        teamName,
        totalScore,
        totalHits,
        totalShots,
        averageAccuracy,
        memberCount: members.length,
        members: sortedMembers,
        survivalVal,
      };
    });

    // Sort teams by survival/score depending on activeTab
    return teamsArray.sort((a, b) => {
      if (competitionMode === "team") {
        if (activeTab === "survival") {
          const rankA = teamRanks[a.teamName] || 999;
          const rankB = teamRanks[b.teamName] || 999;
          if (rankA !== rankB) {
            return rankA - rankB;
          }
          return a.teamName.localeCompare(b.teamName, "vi");
        } else {
          const rankA = teamRanksAllRound[a.teamName] || 999;
          const rankB = teamRanksAllRound[b.teamName] || 999;
          if (rankA !== rankB) {
            return rankA - rankB;
          }
          return a.teamName.localeCompare(b.teamName, "vi");
        }
      } else {
        // Individual Mode: Sort descending by totalScore, then by averageAccuracy, then alphabetically
        if (a.totalScore !== b.totalScore) {
          return b.totalScore - a.totalScore;
        }
        if (b.averageAccuracy !== a.averageAccuracy) {
          return b.averageAccuracy - a.averageAccuracy;
        }
        return a.teamName.localeCompare(b.teamName, "vi");
      }
    });
  }, [
    activeAthletesForCalculation,
    activeTab,
    competitionMode,
    distances,
    shotsCount,
    athleteSurvivalMap,
    teamRoundResults,
    teamRanks,
    teamRanksAllRound
  ]);

  // Compute standard joint ranks for display output
  const teamDisplayRanks = useMemo(() => {
    const ranks: Record<string, number> = {};
    if (competitionMode === "team") {
      if (activeTab === "survival") {
        return teamRanks;
      } else {
        return teamRanksAllRound;
      }
    } else {
      // In individual mode, compute standard joint ranks based on totalScore of the sorted teams
      const sortedTeams = [...teamLeaderboardData];
      sortedTeams.forEach((t) => {
        let betterTeamsCount = 0;
        sortedTeams.forEach((other) => {
          if (other.teamName === t.teamName) return;
          if (other.totalScore > t.totalScore) {
            betterTeamsCount++;
          } else if (other.totalScore === t.totalScore && other.averageAccuracy > t.averageAccuracy) {
            betterTeamsCount++;
          }
        });
        ranks[t.teamName] = betterTeamsCount + 1;
      });
    }
    return ranks;
  }, [competitionMode, activeTab, teamRanks, teamRanksAllRound, teamLeaderboardData]);

  const getTeamRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="flex items-center gap-1 bg-amber-500 text-white font-mono font-bold text-xs px-2.5 py-1 rounded-lg shadow-sm shadow-amber-300">
            <Trophy className="w-3.5 h-3.5" /> {language === "en" ? "Rank 1" : "Hạng 1"}
          </div>
        );
      case 2:
        return (
          <div className="flex items-center gap-1 bg-slate-300 text-slate-800 font-mono font-bold text-xs px-2.5 py-1 rounded-lg shadow-sm">
            <Medal className="w-3.5 h-3.5 text-slate-700" /> {language === "en" ? "Rank 2" : "Hạng 2"}
          </div>
        );
      case 3:
        return (
          <div className="flex items-center gap-1 bg-amber-700 text-white font-mono font-bold text-xs px-2.5 py-1 rounded-lg shadow-sm">
            <Award className="w-3.5 h-3.5" /> {language === "en" ? "Rank 3" : "Hạng 3"}
          </div>
        );
      default:
        return (
          <span className="font-mono text-xs font-bold text-gray-550 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
            {language === "en" ? `Rank #${rank}` : `Hạng #${rank}`}
          </span>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5 shadow-sm" id="team-leaderboard-panelOff">
      <div className="mb-6 pb-4 border-b border-gray-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5.5 h-5.5 text-indigo-600 dark:text-indigo-400" />
            {language === "en" ? "Team Standings" : "Bảng Xếp Hạng Đồng Đội (Team Standings)"}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {competitionMode === "team"
              ? activeTab === "survival"
                ? (language === "en" ? "Direct elimination standing of primary teams, sorted by survival index/points." : "Bảng thi đấu loại trực tiếp của các đội bắn chính, sắp xếp theo thời gian vũ trang lâu nhất.")
                : (language === "en" ? "Tournament cumulative points breakdown of primary teams." : "Bảng tổng điểm các vòng thi đấu tích luỹ gộp của toàn giải đấu đối với các đội bắn chính.")
              : activeTab === "survival"
                ? (language === "en" ? "Team standings based on cumulative score of primary shooting athletes." : "Bảng xếp hạng đồng đội dựa trên tổng điểm tích lũy của các vận động viên bắn chính.")
                : (language === "en" ? "Team standings for all group athletes, including primary and backup athletes." : "Bảng xếp hạng đồng đội đối với tất cả vận động viên của nhóm, bao gồm cả bắn chính và dự bị.")}
          </p>
        </div>
      </div>

      {/* Tab Selector Area */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-100/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-2 rounded-2xl mb-6">
        <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider px-3">
          {language === "en" ? "Team Standings Format:" : "Hình thức xếp hạng đồng đội:"}
        </span>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab("survival")}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2 border shadow-xs ${
              activeTab === "survival"
                ? "bg-gradient-to-r from-blue-600 to-indigo-700 text-white border-indigo-700 shadow-md transform scale-102"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-880 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <Shield className="w-4 h-4" />
            {competitionMode === "individual" 
              ? (language === "en" ? "Primary Team" : "Team Bắn Chính") 
              : (language === "en" ? "Current Standings" : "BXH Hiện Tại")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("allRound")}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2 border shadow-xs ${
              activeTab === "allRound"
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white border-amber-600 shadow-md transform scale-102"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-880 hover:bg-slate-50 dark:hover:bg-slate-805"
            }`}
          >
            <Trophy className="w-4 h-4" />
            {competitionMode === "individual" 
              ? (language === "en" ? "All Athletes" : "500 Anh Em") 
              : (language === "en" ? "Tournament (Cumulative)" : "Toàn Giải (Cộng dồn)")}
          </button>
        </div>
      </div>

      {teamLeaderboardData.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl text-gray-400">
          {language === "en" ? "No primary athletes or clubs available to generate team standings." : "Chưa có vận động viên bắn chính hay câu lạc bộ nào để tổng hợp bảng đội."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {teamLeaderboardData.map((team, idx) => {
            const rank = teamDisplayRanks[team.teamName] || idx + 1;

            const isIndividualTeam = team.teamName.includes("VĐV Tự Do");

            const isTeamEliminated = competitionMode === "team" && activeTab === "survival" && team.survivalVal < distances.length;
            const lastActiveRound = isTeamEliminated ? distances[team.survivalVal] : null;

            return (
              <div 
                key={team.teamName}
                className={`flex flex-col md:flex-row rounded-xl border transition-all hover:shadow-md duration-250 ${
                  isTeamEliminated
                    ? "border-red-200 bg-red-50/5 dark:bg-red-950/5 opacity-85"
                    : rank === 1 
                      ? "border-amber-400/80 bg-amber-50/5 dark:bg-amber-500/5" 
                      : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                }`}
              >
                {/* Team Info Header - Left block on desktop */}
                <div className={`p-5 md:w-80 md:border-r border-b md:border-b-0 border-gray-100 dark:border-slate-800 shrink-0 flex flex-col justify-between ${
                  isTeamEliminated
                    ? "bg-red-50/10 dark:bg-red-950/10"
                    : rank === 1 
                      ? "bg-amber-50/15 dark:bg-amber-500/10" 
                      : "bg-slate-50/30 dark:bg-slate-800/30"
                }`}>
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      {getTeamRankBadge(rank)}
                      
                      <div className="text-right">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                          {language === "en" ? "Team Score" : "Tổng điểm Đội"}
                        </span>
                        <span className={`text-xl font-black font-mono ${
                          isTeamEliminated 
                            ? "text-red-600 dark:text-red-400" 
                            : "text-blue-700 dark:text-blue-400"
                        }`}>
                          {team.totalScore} <span className="text-xs font-normal text-slate-500">{language === "en" ? "pts" : "đ"}</span>
                        </span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <h3 className="text-base font-extrabold text-slate-800 dark:text-white line-clamp-2 flex items-center gap-1.5" title={team.teamName}>
                        {team.teamName}
                        {isIndividualTeam && (
                          <span className="text-[9px] text-gray-500 dark:text-gray-400 font-normal italic px-1 bg-gray-150 dark:bg-slate-800 rounded shrink-0">
                            {language === "en" ? "Free" : "Tự Do"}
                          </span>
                        )}
                      </h3>

                      {activeTab === "survival" && competitionMode === "team" && (
                        <div className="mt-2.5">
                          {isTeamEliminated ? (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-300 font-bold uppercase">
                              {language === "en" ? `Eliminated • Round ${team.survivalVal + 1}` : `Bị loại • Vòng ${team.survivalVal + 1}`} ({lastActiveRound?.distance || ""})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 font-bold uppercase">
                              {language === "en" ? "Successfully Advanced!" : "Trụ hạng thành công!"}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-[11px] text-gray-400 mt-4 font-mono border-t border-gray-100/50 dark:border-slate-800/50 pt-2 shrink-0">
                    <span className="flex items-center gap-0.5">
                      <Users className="w-3 h-3 text-gray-400 font-sans" />
                      <strong>{team.memberCount}</strong> {language === "en" ? "Athletes" : "VĐV"} ({competitionMode === "team" || activeTab === "survival" ? (language === "en" ? "primary" : "chính") : (language === "en" ? "member" : "thành viên")})
                    </span>
                    <span>&bull;</span>
                    <span>
                      {isPointModeActive 
                        ? (language === "en" ? "Score Efficiency: " : "Hiệu suất điểm: ") 
                        : (language === "en" ? "Hits: " : "Hộp trúng: ")}
                      <strong className="text-emerald-650 dark:text-emerald-400 font-semibold">{team.averageAccuracy.toFixed(1)}%</strong>
                    </span>
                  </div>
                </div>

                {/* Team Members Ranked List - Right block on desktop */}
                <div className="flex-1 p-4 flex flex-col justify-center divide-y divide-gray-100 dark:divide-slate-800">
                  <div className="text-[11px] text-gray-400 font-semibold pb-1.5 uppercase tracking-wider font-sans">
                    {competitionMode === "team" || activeTab === "survival" 
                      ? (language === "en" ? "Primary athletes contributing score:" : "Vận động viên bắn chính đóng góp điểm:") 
                      : (language === "en" ? "All athletes contributing score:" : "Tất cả vận động viên đóng góp điểm:")}
                  </div>
                  {team.members.map((member, memberIdx) => {
                    const memberRank = memberIdx + 1;
                    const originAth = athletes.find(a => a.id === member.id);
                    const isBackup = originAth && !originAth.isPrimaryTeam;

                    return (
                      <div 
                        key={member.id} 
                        className={`py-2 px-2 flex items-center justify-between gap-3 text-xs sm:text-sm ${
                          memberIdx === 0 ? "bg-amber-500/5 dark:bg-amber-500/10 font-medium rounded-lg" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-5 h-5 text-[10px] font-mono font-bold rounded-full flex items-center justify-center shrink-0 ${
                            memberRank === 1 
                              ? "bg-amber-100 dark:bg-amber-955/40 text-amber-800 dark:text-amber-300"
                              : "bg-gray-100 dark:bg-slate-800 text-gray-500"
                          }`}>
                            {memberRank}
                          </span>

                          <div className="min-w-0">
                            <span className="font-bold text-gray-800 dark:text-slate-100 flex items-center gap-1.5 truncate" title={member.name}>
                              <span className="truncate">{member.name}</span>
                              {isBackup && (
                                <span className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold px-1 py-0.5 bg-amber-55 dark:bg-amber-950/40 rounded shrink-0">
                                  {language === "en" ? "Backup" : "Dự bị"}
                                </span>
                              )}
                            </span>
                            <span className="text-[9px] font-mono text-gray-400 block">
                              {language === "en" ? "Athlete ID" : "Mã số VĐV"}: {member.id}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400">
                            {member.totalScore}
                          </span>
                          <span className="text-[10px] text-gray-400 ml-0.5">{language === "en" ? "pts" : "đ"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
