import React, { useMemo } from "react";
import { createPortal } from "react-dom";
import { Athlete, MatchHistoryItem } from "../types";
import { User, X, FileText, Lock, Award } from "lucide-react";
import { AVATAR_MALE } from "./AthleteManagement";

interface AthleteProfileModalProps {
  athlete: Athlete | null;
  isOpen: boolean;
  onClose: () => void;
  history: MatchHistoryItem[];
  onlineTournaments?: any[];
  currentUser: any;
  isGlobalAdmin: boolean;
  language?: "vi" | "en";
}

export const AthleteProfileModal: React.FC<AthleteProfileModalProps> = ({
  athlete,
  isOpen,
  onClose,
  history,
  onlineTournaments = [],
  currentUser,
  isGlobalAdmin,
  language = "vi",
}) => {
  // Prevent background scroll when modal is open
  React.useEffect(() => {
    if (isOpen && athlete) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, athlete]);

  // Calculate detailed historical tournament statistics for the athlete
  const athleteStats = useMemo(() => {
    if (!athlete) return null;
    const athleteIdLower = athlete.id.trim().toLowerCase();
    const athleteNameLower = athlete.name.trim().toLowerCase();
    const athleteEmailLower = athlete.email?.trim().toLowerCase() || "";

    // Gather all matching participations across historical and online tournaments
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

        // Count scores
        if (targetAthleteData.scores) {
          Object.values(targetAthleteData.scores).forEach((scoreArr) => {
            if (Array.isArray(scoreArr)) {
              matchShots += scoreArr.length;
              matchHits += scoreArr.filter((h) => h === true).length;
            }
          });
        }

        // Only count as participated if there are actual shots fired/recorded
        if (matchShots > 0) {
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
              return { id: ath.id, name: ath.name, email: ath.email, hits };
            })
            .sort((a: any, b: any) => b.hits - a.hits);

          const matchRankIdx = sortedScores.findIndex(
            (x: any) => {
              const idMatch = x.id && targetAthleteData.id && x.id.trim().toLowerCase() === targetAthleteData.id.trim().toLowerCase();
              const emailMatch = x.email && targetAthleteData.email && x.email.trim().toLowerCase() === targetAthleteData.email.trim().toLowerCase();
              return idMatch || emailMatch;
            }
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
            hitRate: Math.round((matchHits / matchShots) * 100),
            rank
          });
        }
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
  }, [athlete, onlineTournaments, language]);

  if (!isOpen || !athlete) return null;

  const showIdCard = isGlobalAdmin || (currentUser && athlete.email && athlete.email.trim().toLowerCase() === currentUser.email.trim().toLowerCase());

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-fadeIn text-slate-800 dark:text-slate-100" 
      onClick={onClose}
    >
      <div 
        className="relative my-auto w-full max-w-2xl bg-slate-50 dark:bg-slate-950 rounded-2xl shadow-2xl z-[170] flex flex-col text-left overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[85vh] shrink-0 animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header section */}
        <div className="bg-[#9c0c13] text-white p-4 sm:p-5 flex items-center justify-between shadow-md border-b border-red-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-xl border border-white/10 shrink-0">
              <User className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-yellow-300">
                {language === "en" ? "Biographical Sheet" : "Hồ sơ cá nhân"}
              </h3>
              <p className="text-[10px] text-red-100">
                {language === "en" ? "Detailed VSC athlete profile" : "Chi tiết Hồ sơ vận động viên VSC"}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/10 text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content section */}
        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 flex-1 overflow-y-auto">
          {/* Profile Avatar & Hero Information Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm text-center relative overflow-hidden">
            <div className="absolute top-3 right-3 bg-red-50 dark:bg-red-950/25 border border-red-100 dark:border-red-900/30 text-[#9c0c13] dark:text-red-400 text-xs font-black px-2.5 py-1 rounded-lg">
              {athlete.id}
            </div>
            
            <div className="flex flex-col items-center gap-3">
              <div className="relative shrink-0">
                <img 
                  src={athlete.avatarUrl || AVATAR_MALE} 
                  alt={athlete.name} 
                  className="w-24 h-24 rounded-full object-cover border-4 border-[#9c0c13]/10 bg-slate-50 shadow-md aspect-square shrink-0"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute bottom-0 right-1.5 bg-[#9c0c13] text-white p-1 rounded-full text-[10px] shadow border-2 border-white">
                  ✓
                </span>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center justify-center gap-1.5">
                  {athlete.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-bold">
                  🛡️ {athlete.team || (language === "en" ? "Independent" : "Tự do")}
                </p>
              </div>
            </div>
          </div>

          {/* Personal Details Block */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800/80 pb-2 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#9c0c13]" />
              {language === "en" ? "Personal Information" : "Thông tin cá nhân"}
            </h4>
            
            <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-xs">
              <div>
                <div className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase mb-0.5">
                  {language === "en" ? "Gender" : "Giới tính"}
                </div>
                <div className="font-extrabold text-slate-700 dark:text-slate-200">{athlete.gender || "Nam"}</div>
              </div>
              <div>
                <div className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase mb-0.5">
                  {language === "en" ? "Date of birth" : "Ngày sinh"}
                </div>
                <div className="font-extrabold text-slate-700 dark:text-slate-200">{athlete.dob || "---"}</div>
              </div>
              <div>
                <div className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase mb-0.5">
                  {language === "en" ? "Province" : "Tỉnh thành"}
                </div>
                <div className="font-extrabold text-slate-700 dark:text-slate-200">{athlete.province || "---"}</div>
              </div>
              <div>
                <div className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase mb-0.5">
                  {language === "en" ? "Hometown" : "Quê quán"}
                </div>
                <div className="font-extrabold text-slate-700 dark:text-slate-200">{athlete.hometown || "---"}</div>
              </div>
              
              <div className="col-span-2 border-t border-slate-100 dark:border-slate-800/60 pt-3 mt-1.5">
                <div className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase mb-0.5">
                  {language === "en" ? "Linked Email" : "Email tài khoản liên kết"}
                </div>
                <div className="font-extrabold text-slate-700 dark:text-slate-200 break-all flex items-center gap-1.5">
                  {athlete.email ? (
                    <>
                      <span className="text-emerald-600 dark:text-emerald-400">●</span> {athlete.email}
                    </>
                  ) : (
                    <span className="text-slate-400 font-normal italic">
                      {language === "en" ? "No email linked" : "Chưa liên kết email"}
                    </span>
                  )}
                </div>
              </div>

              {showIdCard && athlete.idCard && (
                <div className="col-span-2 border-t border-slate-100 dark:border-slate-800/60 pt-3">
                  <div className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase mb-0.5 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-red-500" /> 
                    {language === "en" ? "ID Card / Passport (Protected)" : "Số CCCD (Bảo mật)"}
                  </div>
                  <div className="font-extrabold text-[#9c0c13] dark:text-red-400">{athlete.idCard}</div>
                </div>
              )}
            </div>
          </div>

          {/* Stats and historical achievements */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800/80 pb-2 mb-4 flex items-center gap-2">
              <Award className="w-4 h-4 text-[#9c0c13]" />
              {language === "en" ? "Competition Achievement Statistics" : "Thống kê thành tích thi đấu"}
            </h4>

            {athleteStats && athleteStats.totalTournaments > 0 ? (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-900">
                    <div className="text-[9px] font-extrabold text-slate-450 uppercase">
                      {language === "en" ? "Tournaments" : "Số Giải"}
                    </div>
                    <div className="text-base font-black text-[#9c0c13] mt-0.5">{athleteStats.totalTournaments}</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-900">
                    <div className="text-[9px] font-extrabold text-slate-450 uppercase">
                      {language === "en" ? "Hit Rate" : "Tỷ Lệ Trúng"}
                    </div>
                    <div className="text-base font-black text-emerald-600 mt-0.5">{athleteStats.overallHitRate}%</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-900">
                    <div className="text-[9px] font-extrabold text-slate-450 uppercase">
                      {language === "en" ? "Best Rank" : "Hạng Cao Nhất"}
                    </div>
                    <div className="text-base font-black text-amber-500 mt-0.5">
                      {athleteStats.highestRank ? `#${athleteStats.highestRank}` : "---"}
                    </div>
                  </div>
                </div>

                {athleteStats.participations.length > 1 && (
                  <div className="space-y-2 text-center">
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center justify-between">
                      <span>{language === "en" ? "Progress Chart" : "Biểu đồ tiến trình"}</span>
                      <span className="font-black text-[#9c0c13]">{athleteStats.overallHitRate}% ({language === "en" ? "Average" : "Trung bình"})</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-xl p-3 h-28 flex items-end">
                      <svg className="w-full h-full" viewBox="0 0 300 80">
                        <line x1="0" y1="10" x2="300" y2="10" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3,3" />
                        <line x1="0" y1="40" x2="300" y2="40" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3,3" />
                        <line x1="0" y1="70" x2="300" y2="70" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3,3" />
                        
                        {(() => {
                          const points = [...athleteStats.participations].reverse();
                          const widthStep = 300 / (points.length - 1 || 1);
                          
                          const coords = points.map((p, idx) => {
                            const x = idx * widthStep;
                            const y = 70 - (p.hitRate / 100) * 60;
                            return { x, y };
                          });

                          const d = coords.reduce((acc, c, idx) => {
                            return idx === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`;
                          }, "");

                          return (
                            <>
                              {coords.length > 1 && (
                                <path
                                  d={`${d} L ${coords[coords.length-1].x} 70 L ${coords[0].x} 70 Z`}
                                  fill="rgba(156, 12, 19, 0.05)"
                                />
                              )}
                              <path d={d} fill="none" stroke="#9c0c13" strokeWidth="2.5" />
                              {coords.map((c, idx) => (
                                <g key={idx}>
                                  <circle cx={c.x} cy={c.y} r="4" fill="#9c0c13" stroke="#fff" strokeWidth="1" />
                                  <title>{points[idx].matchName}: {points[idx].hitRate}%</title>
                                </g>
                              ))}
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                  </div>
                )}

                {/* Match Participation List */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                    {language === "en" ? "Tournament History" : "Lịch sử tham gia giải đấu"}
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-48 overflow-y-auto">
                    {athleteStats.participations.map((p, idx) => (
                      <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="min-w-0 pr-2">
                          <div className="font-extrabold text-slate-700 dark:text-slate-200 truncate">{p.matchName}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{p.date}</div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="font-mono font-bold text-slate-500">{p.totalHits}/{p.totalShots}</span>
                            <span className="text-[10px] text-emerald-600 font-black ml-1.5 bg-emerald-50 px-1 py-0.5 rounded">
                              {p.hitRate}%
                            </span>
                          </div>
                          <div className="bg-amber-100/75 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-md min-w-[32px] text-center">
                            #{p.rank}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs italic">
                {language === "en" ? "No competition data found in system history" : "Chưa có dữ liệu thi đấu nào trong lịch sử hệ thống"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
