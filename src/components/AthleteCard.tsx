import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../context/LanguageContext";
import { Athlete, DistanceConfig } from "../types";
import { Check, Edit2, Trash2, Shield, User, Users, Save, X, ChevronUp, ChevronDown, Lock, Unlock } from "lucide-react";
import { AVATAR_MALE } from "./AthleteManagement";
import { getHitCount } from "../utils/qualification";

interface AthleteCardProps {
  athlete: Athlete;
  distances: DistanceConfig[];
  shotsCount: number;
  onToggleScore: (athleteId: string, distanceId: string, shotIndex: number) => void;
  onUpdateAthlete: (athleteId: string, name: string, team: string, customId?: string) => void;
  onDeleteAthlete: (athleteId: string) => void;
  onMoveAthlete?: (athleteId: string, direction: "up" | "down") => void;
  isFirst?: boolean;
  isLast?: boolean;
  isInputTab?: boolean;
  mainAthletes?: Athlete[];
  onUpdateSoloHits?: (athleteId: string, distanceId: string, rounds: (number | null)[]) => void;
  isScoringEditAuthorized?: boolean;
  onTriggerUnlockModal?: () => void;
  onUpdateDirectScore?: (athleteId: string, distanceId: string, value: number | null) => void;
  directMaxPoints?: number;
  isLockedByOtherReferee?: boolean;
  lockedByRefereeEmail?: string;
}

export const AthleteCard: React.FC<AthleteCardProps> = ({
  athlete,
  distances,
  shotsCount,
  onToggleScore,
  onUpdateAthlete,
  onDeleteAthlete,
  onMoveAthlete,
  isFirst = false,
  isLast = false,
  isInputTab = false,
  mainAthletes = [],
  onUpdateSoloHits,
  isScoringEditAuthorized = false,
  onTriggerUnlockModal,
  onUpdateDirectScore,
  directMaxPoints,
  isLockedByOtherReferee = false,
  lockedByRefereeEmail = "",
}) => {
  const { language, t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(athlete.name);
  const [editTeam, setEditTeam] = useState(athlete.team);
  const [editIdString, setEditIdString] = useState(athlete.id);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isInputSoloLocked, setIsInputSoloLocked] = useState(true);
  const [showLocalUnlockModal, setShowLocalUnlockModal] = useState(false);

  const isDirectMode = shotsCount === 1;

  // Calculate scores per distance row
  const rowScores = distances.map((distance) => {
    const hits = athlete.scores[distance.id] || [];
    const hitCount = getHitCount(hits);
    const score = hitCount * distance.multiplier;
    return {
      distanceId: distance.id,
      hitCount,
      score,
    };
  });

  // Calculate total score
  const totalScore = rowScores.reduce((sum, item) => sum + item.score, 0);

  const handleSave = () => {
    if (editName.trim() === "") return;
    onUpdateAthlete(athlete.id, editName.trim(), editTeam.trim(), editIdString.trim());
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(athlete.name);
    setEditTeam(athlete.team);
    setEditIdString(athlete.id);
    setIsEditing(false);
  };

  return (
    <div 
      className="border-2 border-blue-600 dark:border-blue-500 rounded-3xl p-4 sm:p-5 bg-white shadow-md hover:shadow-lg transition-shadow duration-200"
      id={`athlete-card-${athlete.id}`}
    >
      {/* Card Header metadata */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-3 mb-4 gap-3">
        {isEditing ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full sm:w-auto flex-1">
            <div className="flex items-center bg-gray-50 border border-gray-300 rounded px-2 py-1">
              <span className="text-xs font-semibold text-gray-500 mr-1.5 font-mono">ID:</span>
              <input
                type="text"
                value={editIdString}
                onChange={(e) => setEditIdString(e.target.value)}
                placeholder="ID"
                className="w-full text-sm font-mono focus:outline-none bg-transparent"
              />
            </div>
            <div className="flex items-center bg-gray-50 border border-gray-300 rounded px-2 py-1">
              <User className="w-3.5 h-3.5 text-gray-400 mr-1.5" />
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={language === "en" ? "Athlete name" : "Tên vận động viên"}
                className="w-full text-sm focus:outline-none bg-transparent"
              />
            </div>
            <div className="flex items-center bg-gray-50 border border-gray-300 rounded px-2 py-1">
              <Users className="w-3.5 h-3.5 text-gray-400 mr-1.5" />
              <input
                type="text"
                value={editTeam}
                onChange={(e) => setEditTeam(e.target.value)}
                placeholder={language === "en" ? "Team / Club" : "Đội / CLB"}
                className="w-full text-sm focus:outline-none bg-transparent"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <img 
              src={athlete.avatarUrl || AVATAR_MALE} 
              alt={athlete.name} 
              className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="flex flex-col sm:flex-row sm:items-center gap-x-3 gap-y-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                  ID: {athlete.id}
                </span>
                <span className="text-base font-extrabold text-gray-900 font-sans">
                  {athlete.name}
                </span>
              </div>
              {athlete.team && (
                <span className="text-xs text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full font-bold self-start sm:self-auto">
                  {athlete.team}
                </span>
              )}
              {athlete.status === "Bỏ thi" && (
                <span className="text-xs text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full font-extrabold self-start sm:self-auto border border-rose-200">
                  ⚠️ {language === "en" ? "WITHDRAWN" : "BỎ THI"}
                </span>
              )}
              {isLockedByOtherReferee && (
                <span className="text-[11px] text-amber-700 dark:text-amber-350 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-full font-extrabold border border-amber-200 dark:border-amber-900/40 shrink-0 self-start sm:self-auto flex items-center gap-1.5 leading-none shadow-sm animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  🔒 {language === "en" ? "SCORING IN PROGRESS BY REFEREE" : "ĐANG GHI ĐIỂM BỞI TRỌNG TÀI"}: {lockedByRefereeEmail}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="p-1 px-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors flex items-center gap-1"
                title={language === "en" ? "Save" : "Lưu"}
              >
                <Save className="w-3 h-3" /> {language === "en" ? "Save" : "Lưu"}
              </button>
              <button
                onClick={handleCancel}
                className="p-1 px-2 text-xs font-semibold bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors flex items-center gap-1"
                title={language === "en" ? "Cancel" : "Hủy"}
              >
                <X className="w-3 h-3" /> {language === "en" ? "Cancel" : "Hủy"}
              </button>
            </>
          ) : !isLockedByOtherReferee ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onMoveAthlete && onMoveAthlete(athlete.id, "up")}
                disabled={isFirst}
                className={`p-1.5 rounded-full transition-colors ${
                  isFirst 
                    ? "text-gray-300 dark:text-gray-700 cursor-not-allowed" 
                    : "text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                }`}
                title={language === "en" ? "Move up" : "Di chuyển lên trên"}
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => onMoveAthlete && onMoveAthlete(athlete.id, "down")}
                disabled={isLast}
                className={`p-1.5 rounded-full transition-colors ${
                  isLast 
                    ? "text-gray-300 dark:text-gray-700 cursor-not-allowed" 
                    : "text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                }`}
                title={language === "en" ? "Move down" : "Di chuyển xuống dưới"}
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-full transition-colors cursor-pointer"
                title={language === "en" ? "Edit athlete info" : "Sửa thông tin VĐV"}
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-955/20 text-gray-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-full transition-colors cursor-pointer"
                title={language === "en" ? "Delete athlete" : "Xóa vận động viên"}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Grid Container for the score sheets */}
      <div className="overflow-x-auto select-none rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-left text-sm table-fixed min-w-[700px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {/* Diểm Tổng Column header */}
              <th className="border-r border-gray-200 text-center font-bold text-gray-800 bg-gray-100/70 p-2 w-[110px]">
                {language === "en" ? "TOTAL SCORE" : "ĐIỂM TỔNG"}
              </th>
              {/* Điểm Column header */}
              <th className="border-r border-gray-200 text-center font-bold text-gray-800 p-2 w-[85px]">
                {language === "en" ? "Score" : "Điểm"}
              </th>
              {/* Điểm nhân Column header */}
              <th className="border-r border-gray-200 text-center font-semibold text-gray-700 p-2 w-[85px]">
                {language === "en" ? "Multiplier" : "Điểm nhân"}
              </th>
              {/* Cự ly Column header */}
              <th className="border-r border-gray-200 text-center font-semibold text-gray-700 p-2 w-[100px]">
                {language === "en" ? "Distance" : "Cự ly"}
              </th>
              {/* Lượt bắn spanned header */}
              <th 
                colSpan={shotsCount} 
                className="text-center font-semibold text-gray-700 p-2 bg-slate-50 border-b border-gray-200"
              >
                {language === "en" ? "Shots (Target)" : "Lượt bắn (Mục tiêu)"}
              </th>
            </tr>
            <tr className="bg-slate-50 border-b border-gray-100 text-xs">
              {/* Spanners */}
              <th className="border-r border-gray-200"></th>
              <th className="border-r border-gray-200"></th>
              <th className="border-r border-gray-200"></th>
              <th className="border-r border-gray-200"></th>
              {/* Shot index row */}
              {Array.from({ length: shotsCount }).map((_, idx) => (
                <th 
                  key={idx} 
                  className={`text-center font-mono font-bold text-gray-500 border-r border-gray-100 py-1 bg-white ${
                    idx === shotsCount - 1 ? "" : "border-r"
                  }`}
                >
                  {idx + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {distances.map((distance, distIdx) => {
              const rowScoreObj = rowScores.find((r) => r.distanceId === distance.id) || { hitCount: 0, score: 0 };
              const hits = athlete.scores[distance.id] || Array(shotsCount).fill(null);

              // Check if distance has pre-existing scores in main tournament ledger (Ghi Điểm)
              const scoringAthlete = mainAthletes?.find((a) => a.id === athlete.id);
              const isDistancePreExisting = isInputTab && scoringAthlete && scoringAthlete.scores[distance.id] && scoringAthlete.scores[distance.id].some((slot) => slot !== null);

              return (
                <tr 
                  key={distance.id} 
                  className={`transition-colors ${
                    isDistancePreExisting 
                      ? "bg-slate-100/50 dark:bg-slate-900/30 text-gray-400 select-none cursor-not-allowed opacity-75"
                      : "hover:bg-slate-50/50"
                  } ${
                    distIdx < distances.length - 1 ? "border-b border-gray-200" : ""
                  }`}
                >
                  {/* DIỂM TỔNG spanned tall cell in first row only */}
                  {distIdx === 0 && (
                    <td 
                      rowSpan={distances.length} 
                      className="border-r border-gray-200 align-middle text-center font-mono text-3xl font-extrabold text-blue-700 bg-blue-50/50 p-2 select-text"
                    >
                      {totalScore}
                    </td>
                  )}

                  {/* Điểm (Current row score computed) */}
                  <td className={`border-r border-gray-200 text-center font-mono text-lg font-bold p-2 ${
                    isDistancePreExisting ? "text-gray-400 bg-slate-200/20" : "text-gray-800 bg-amber-50/30"
                  }`}>
                    {rowScoreObj.score}
                    <div className="text-[10px] text-gray-400 font-normal mt-0.5">
                      ({rowScoreObj.hitCount} {language === "en" ? "hits" : "viên"})
                    </div>
                  </td>

                  {/* Điểm nhân (Multiplier) */}
                  <td className="border-r border-gray-200 text-center font-mono text-sm text-gray-500 p-2">
                    {distance.multiplier}
                  </td>

                  {/* Cự ly (Distance) */}
                  <td className="border-r border-gray-200 text-center text-sm font-bold text-gray-700 p-2">
                    <div className="text-[10px] text-indigo-500 font-mono font-bold block mb-0.5">{language === "en" ? "Round" : "Vòng"} {distIdx + 1}</div>
                    <div className="flex items-center justify-center gap-1">
                      <span>{distance.distance}</span>
                      {isDistancePreExisting && (
                        <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 inline-block" title={language === "en" ? "Score protected" : "Điểm số đã được bảo vệ"} />
                      )}
                    </div>
                    {isDistancePreExisting && (
                      <span className="text-[8.5px] uppercase font-bold text-emerald-600 block mt-0.5">{language === "en" ? "Locked" : "Đã Khóa"}</span>
                    )}

                    {distance.isElimination && distance.isSolo && (() => {
                      const rounds = athlete.soloRounds?.[distance.id] ?? 
                        (athlete.soloHits?.[distance.id] !== undefined && athlete.soloHits[distance.id] !== null ? [athlete.soloHits[distance.id]] : [null]);

                      const isLocked = isInputSoloLocked || (!isInputTab && !isScoringEditAuthorized) || isLockedByOtherReferee;

                      return (
                        <div className="mt-2 flex flex-col items-center bg-purple-50 hover:bg-purple-100/75 dark:bg-slate-900 border border-purple-200 rounded p-1.5 animate-fadeIn mx-1 min-w-[75px]">
                          <span className="text-[8.5px] text-purple-700 dark:text-purple-400 font-black uppercase leading-tight text-center flex items-center gap-1 justify-center">
                            {language === "en" ? "Solo Score" : "Điểm Solo"}
                            {isInputTab ? (
                              isInputSoloLocked ? (
                                <Lock className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400 cursor-pointer" onClick={() => {
                                  if (isLockedByOtherReferee) {
                                    alert(`Lỗi: Vận động viên này đang được ghi điểm bởi trọng tài khác (${lockedByRefereeEmail}). Bạn không được chỉnh sửa!`);
                                    return;
                                  }
                                  setShowLocalUnlockModal(true);
                                }} />
                              ) : (
                                <Unlock className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 cursor-pointer" onClick={() => {
                                  if (isLockedByOtherReferee) return;
                                  setIsInputSoloLocked(true);
                                }} />
                              )
                            ) : (
                              !isScoringEditAuthorized ? (
                                <Lock className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400 cursor-pointer" onClick={() => {
                                  if (isLockedByOtherReferee) {
                                    alert(`Lỗi: Vận động viên này đang được ghi điểm bởi trọng tài khác (${lockedByRefereeEmail}). Bạn không được chỉnh sửa!`);
                                    return;
                                  }
                                  onTriggerUnlockModal?.();
                                }} />
                              ) : (
                                isInputSoloLocked ? (
                                  <Lock className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400 cursor-pointer" onClick={() => {
                                    if (isLockedByOtherReferee) return;
                                    setShowLocalUnlockModal(true);
                                  }} />
                                ) : (
                                  <Unlock className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 cursor-pointer" onClick={() => {
                                    if (isLockedByOtherReferee) return;
                                    setIsInputSoloLocked(true);
                                  }} />
                                )
                              )
                            )}
                          </span>
                          
                          <div className="flex flex-col gap-1 w-full mt-1.5">
                            {rounds.map((roundVal, idx) => (
                              <div key={idx} className="flex items-center justify-center gap-0.5">
                                <span className="text-[8px] text-purple-500 font-mono font-bold">L{idx + 1}:</span>
                                <input
                                  type={isLocked ? "text" : "number"}
                                  min={0}
                                  placeholder="-"
                                  value={isLocked && (roundVal === null || roundVal === undefined) ? "-" : (roundVal ?? "")}
                                  readOnly={isLocked}
                                  onClick={() => {
                                    if (!isInputTab && !isScoringEditAuthorized) {
                                      onTriggerUnlockModal?.();
                                    } else if (isInputSoloLocked) {
                                      setShowLocalUnlockModal(true);
                                    }
                                  }}
                                  onChange={(e) => {
                                    if (isLocked) return;
                                    const raw = e.target.value.trim();
                                    const val = raw === "" ? null : Math.max(0, parseInt(raw, 10) || 0);
                                    const newRounds = [...rounds];
                                    newRounds[idx] = val;
                                    onUpdateSoloHits?.(athlete.id, distance.id, newRounds);
                                  }}
                                  className={`w-9 text-center text-[11px] border rounded font-bold font-mono bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 py-0.2 ${
                                    isLocked
                                      ? "border-slate-300 text-slate-400 cursor-pointer bg-slate-50"
                                      : "border-purple-350 focus:ring-purple-500 text-purple-800"
                                  }`}
                                />
                                {rounds.length > 1 && !isLocked && (
                                  <button
                                    title={language === "en" ? "Delete round" : "Xóa lượt"}
                                    onClick={() => {
                                      const newRounds = rounds.filter((_, rIdx) => rIdx !== idx);
                                      onUpdateSoloHits?.(athlete.id, distance.id, newRounds);
                                    }}
                                    className="text-red-500 hover:text-red-700 hover:scale-110 active:scale-90 transition cursor-pointer text-[11px] font-black px-0.5"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>

                          {!isLocked && (
                            <button
                              title={language === "en" ? "Add solo round" : "Thêm lượt solo"}
                              onClick={() => {
                                onUpdateSoloHits?.(athlete.id, distance.id, [...rounds, null]);
                              }}
                              className="mt-1.5 w-full py-0.5 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded border border-purple-200 hover:bg-purple-200 dark:hover:bg-purple-900 text-[8.5px] font-black flex items-center justify-center gap-0.5 transition cursor-pointer"
                            >
                              + {language === "en" ? "Add" : "Thêm"}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </td>

                   {/* Shots checkboxes or direct score TEXT input */}
                  {isDirectMode ? (
                    <td 
                      colSpan={shotsCount}
                      className={`text-center p-2 border-r border-gray-100 ${
                        isDistancePreExisting 
                          ? "bg-slate-100/40 dark:bg-slate-900/10 cursor-not-allowed" 
                          : "bg-white dark:bg-slate-950"
                      }`}
                    >
                      <div className="flex items-center justify-center">
                        <input
                          type="text"
                          pattern="[0-9]*"
                          inputMode="numeric"
                          placeholder={language === "en" ? "Enter score" : "Nhập điểm"}
                          value={(() => {
                            const val = hits[0];
                            if (val === true || val === "true" || val === "TRUE") return "1";
                            if (val === false || val === "false" || val === "FALSE") return "0";
                            if (val === null || val === undefined) return "";
                            return String(val);
                          })()}
                          disabled={isDistancePreExisting || isLockedByOtherReferee}
                          readOnly={(!isInputTab && !isScoringEditAuthorized) || isLockedByOtherReferee}
                          onClick={(e) => {
                            if (isLockedByOtherReferee) {
                              alert(`Lỗi: Vận động viên này đang được ghi điểm bởi trọng tài khác (${lockedByRefereeEmail}). Bạn không được chỉnh sửa!`);
                              return;
                            }
                            if (!isInputTab && !isScoringEditAuthorized && !isDistancePreExisting) {
                              onTriggerUnlockModal?.();
                            }
                          }}
                          onChange={(e) => {
                            if (isLockedByOtherReferee) {
                              return;
                            }
                            const raw = e.target.value.trim();
                            if (raw !== "" && !/^\d+$/.test(raw)) {
                              return;
                            }
                            const val = raw === "" ? null : parseInt(raw, 10);
                            onUpdateDirectScore?.(athlete.id, distance.id, val);
                          }}
                          className={`w-28 text-center text-xs font-black font-mono border rounded-lg py-1 px-2 focus:outline-none focus:ring-1 ${
                            isDistancePreExisting || isLockedByOtherReferee
                              ? "bg-gray-100 dark:bg-slate-900 border-gray-300 dark:border-slate-800 text-gray-400 cursor-not-allowed"
                              : "bg-white dark:bg-slate-950 border-blue-400 text-blue-800 dark:text-blue-400 focus:ring-blue-500 font-mono"
                          }`}
                        />
                      </div>
                    </td>
                  ) : (
                    Array.from({ length: shotsCount }).map((_, shotIdx) => {
                      const shotVal = hits[shotIdx];
                      const isHit = shotVal === true;
                      const isMiss = shotVal === false;
                      return (
                        <td 
                          key={shotIdx}
                          onClick={() => {
                            if (isLockedByOtherReferee) {
                              alert(`Lỗi: Vận động viên này đang được ghi điểm bởi trọng tài khác (${lockedByRefereeEmail}). Bạn không được chỉnh sửa!`);
                              return;
                            }
                            if (!isDistancePreExisting) {
                              onToggleScore(athlete.id, distance.id, shotIdx);
                            }
                          }}
                          className={`text-center p-1 transition-colors relative border-r border-gray-100 ${
                            isDistancePreExisting || isLockedByOtherReferee
                              ? "cursor-not-allowed bg-slate-100/40 dark:bg-slate-900/10" 
                              : "cursor-pointer hover:bg-blue-50/75"
                          } ${
                            shotIdx === shotsCount - 1 ? "" : "border-r"
                          }`}
                          title={isDistancePreExisting 
                            ? `Điểm cự ly ${distance.distance} đã có sẵn. Muốn sửa, vui lòng chuyển qua tab Ghi Điểm & bật chế độ sửa.` 
                            : `Cự ly: ${distance.distance}, Lượt: ${shotIdx + 1}`}
                        >
                          <div className="flex items-center justify-center py-2">
                            <div 
                              className={`w-6 h-6 rounded flex items-center justify-center transition-all duration-150 border-2 select-none ${
                                isHit 
                                  ? isDistancePreExisting
                                    ? "bg-slate-400 border-slate-400 shadow-sm opacity-60"
                                    : "bg-blue-600 border-blue-600 shadow-sm" 
                                  : isMiss
                                    ? isDistancePreExisting
                                      ? "bg-slate-350 border-slate-350 shadow-sm opacity-55"
                                      : "bg-rose-600 border-rose-600 shadow-sm"
                                    : "bg-white border-gray-300 hover:border-gray-500"
                              }`}
                            >
                              {isHit && (
                                <Check className="w-4 h-4 text-white stroke-[3.5]" />
                              )}
                              {isMiss && (
                                <X className="w-4 h-4 text-white stroke-[3.5]" />
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Simple Quick Summary of athlete accuracy */}
      {(() => {
        const isPointModeActive = shotsCount === 1 && directMaxPoints !== undefined && directMaxPoints > 0;
        const hitCountSum = rowScores.reduce((sum, item) => sum + item.hitCount, 0);

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

        const totalPossibleShots = countShotRounds * shotsCount;
        let totalValMax = totalPossibleShots;
        let actualValSum = hitCountSum;
        let unitText = language === "en" ? "shots" : "viên";
        let labelText = language === "en" ? "Total hits" : "Tổng phát trúng";
        let accuracy = totalPossibleShots > 0 ? (hitCountSum / totalPossibleShots) * 100 : 0;

        if (isPointModeActive && directMaxPoints !== undefined) {
          const totalPossiblePoints = directMaxPoints * totalMultiplierOfShotRounds;
          labelText = language === "en" ? "Score efficiency" : "Hiệu suất điểm";
          actualValSum = totalScore;
          totalValMax = totalPossiblePoints;
          unitText = language === "en" ? "pts" : "điểm";
          accuracy = totalPossiblePoints > 0 ? (totalScore / totalPossiblePoints) * 100 : 0;
        }

        return (
          <div className="mt-3 flex flex-wrap justify-between items-center text-xs text-gray-400 font-sans px-1">
            <div>
              {labelText}: {" "}
              <span className="font-semibold text-gray-700">
                {actualValSum}
              </span>
              /{totalValMax} {unitText} (
              {accuracy.toFixed(1)}
              %)
            </div>
            <div className="flex gap-2 flex-wrap">
              {distances.map((dist, idx) => {
                const rowData = rowScores.find((r) => r.distanceId === dist.id) || { hitCount: 0 };
                return (
                  <span key={dist.id} className="bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
                    {language === "en" ? "R" : "V"}{idx + 1}: {rowData.hitCount} {isPointModeActive ? (language === "en" ? "pts" : "điểm") : (language === "en" ? "shots" : "viên")}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })()}

      {showLocalUnlockModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs animate-fadeIn text-slate-800 dark:text-slate-101">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 animate-scaleIn">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-200 uppercase tracking-wide">
                  {language === "en" ? "Confirm editing Solo score?" : "Xác nhận sửa điểm Solo?"}
                </h3>
                <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">{language === "en" ? "Protection box to avoid accidental edits" : "Hộp bảo vệ tránh chạm nhầm"}</p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
              {language === "en" ? (
                <>Are you sure you want to <strong>unlock</strong> to enter/edit Solo score for athlete <strong>{athlete.name}</strong>?</>
              ) : (
                <>Bạn có chắc chắn muốn <strong>mở khóa</strong> để ghi / sửa điểm Solo cho vận động viên <strong>{athlete.name}</strong> không?</>
              )}
            </p>
            <div className="flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setShowLocalUnlockModal(false)}
                className="px-4 py-2 text-xs font-bold border border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
              >
                {language === "en" ? "Cancel" : "Hủy"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsInputSoloLocked(false);
                  setShowLocalUnlockModal(false);
                }}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-md hover:shadow-lg cursor-pointer"
              >
                {language === "en" ? "Confirm Unlock" : "Xác nhận mở khóa"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showDeleteModal && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[10005] animate-fadeIn text-slate-800 dark:text-slate-101"
          onClick={() => setShowDeleteModal(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-sm w-full border border-slate-200 dark:border-slate-800 animate-scaleUp p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-50 dark:bg-rose-955/30 rounded-full">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-101 uppercase tracking-wide">{language === "en" ? "Confirm delete athlete?" : "Xác nhận xóa VĐV?"}</h3>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
              {language === "en" ? (
                <>Are you sure you want to delete athlete <strong>{athlete.name}</strong>? This will delete the athlete's profile and scores from the current round.</>
              ) : (
                <>Bạn có chắc chắn muốn xóa vận động viên <strong>{athlete.name}</strong> không? Điều này sẽ xóa hồ sơ và điểm số của VĐV khỏi loạt bắn hiện hành.</>
              )}
            </p>

            <div className="flex gap-2.5 justify-end font-sans mt-1">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                {language === "en" ? "Cancel" : "Hủy bỏ"}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteAthlete(athlete.id);
                  setShowDeleteModal(false);
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
              >
                {language === "en" ? "Confirm Delete" : "Đồng ý xóa"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
