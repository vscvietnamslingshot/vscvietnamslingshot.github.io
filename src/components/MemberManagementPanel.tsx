import React, { useState, useEffect } from "react";
import { subscribeToAllUsers, updateUserProfileAdmin, deleteUserProfileAdmin } from "../lib/firebaseService";
import { Users, Search, Edit2, Shield, Mail, Award, X, Check, Eye, Trash2, AlertTriangle } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  club?: string;
  role?: string;
  createdAt?: any;
}

interface MemberManagementPanelProps {
  currentUser: any;
  language: "vi" | "en";
}

export const MemberManagementPanel: React.FC<MemberManagementPanelProps> = ({
  currentUser,
  language
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Edit Form state
  const [editName, setEditName] = useState("");
  const [editPhoto, setEditPhoto] = useState("");
  const [editClub, setEditClub] = useState("");
  const [editRole, setEditRole] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToAllUsers((userList) => {
      setUsers(userList);
    });
    return () => unsubscribe();
  }, []);

  const handleStartEdit = (user: UserProfile) => {
    setEditingUser(user);
    setEditName(user.displayName || "");
    setEditPhoto(user.photoURL || "");
    setEditClub(user.club || "");
    setEditRole(user.role || "user");
    setSuccessMsg("");
    setErrorMsg("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      await updateUserProfileAdmin(editingUser.uid, {
        displayName: editName.trim(),
        photoURL: editPhoto.trim(),
        club: editClub.trim(),
        role: editRole
      });
      setSuccessMsg(language === "en" ? "Updated member successfully!" : "Đã cập nhật thông tin thành viên thành công!");
      setTimeout(() => {
        setEditingUser(null);
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(language === "en" ? "Failed to update member." : "Không thể cập nhật thông tin thành viên.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (deletingUser.uid === currentUser?.uid) {
        throw new Error(language === "en" ? "You cannot delete your own account!" : "Bạn không thể tự xóa tài khoản của chính mình!");
      }
      await deleteUserProfileAdmin(deletingUser.uid);
      setSuccessMsg(language === "en" ? "Deleted member successfully!" : "Đã xóa thành viên thành công!");
      setTimeout(() => {
        setDeletingUser(null);
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || (language === "en" ? "Failed to delete member." : "Không thể xóa thành viên."));
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase();
    return (
      u.displayName?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query) ||
      u.uid?.toLowerCase().includes(query) ||
      u.club?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-150 dark:border-slate-800 p-6 shadow-xs flex flex-col gap-6" id="member-management-panel">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight uppercase flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            {language === "en" ? "Member Management Directory" : "Quản Lý Thành Viên (QLTV)"}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-0.5">
            {language === "en" 
              ? "View and edit administrative roles, club affiliations, and details of all registered users." 
              : "Xem và chỉnh sửa quyền hạn, thông tin câu lạc bộ của tất cả thành viên trong hệ thống."}
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === "en" ? "Search by name, email, club..." : "Tìm tên, email, câu lạc bộ..."}
            className="w-full pl-9.5 pr-4 py-2 bg-gray-50 dark:bg-slate-800/50 border border-gray-250 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-505"
          />
        </div>
      </div>

      {/* Stats Counter */}
      <div className="flex gap-4 border-b border-gray-100 dark:border-slate-800 pb-4">
        <div className="bg-indigo-50 dark:bg-indigo-950/20 px-3 py-2 rounded-xl text-xs font-black text-indigo-650 dark:text-indigo-400">
          {language === "en" ? `Total Members: ${users.length}` : `Tổng thành viên: ${users.length}`}
        </div>
        <div className="bg-amber-50 dark:bg-amber-955/20 px-3 py-2 rounded-xl text-xs font-black text-amber-650 dark:text-amber-400">
          {language === "en" ? `Admins: ${users.filter(u => u.role === "admin").length}` : `Quản trị viên: ${users.filter(u => u.role === "admin").length}`}
        </div>
      </div>

      {/* Main Members Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-150 dark:border-slate-850">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-950 text-gray-500 uppercase font-black tracking-wider border-b border-gray-150 dark:border-slate-850">
              <th className="px-4 py-3.5">{language === "en" ? "Member Profile" : "Thành viên"}</th>
              <th className="px-4 py-3.5">USER ID</th>
              <th className="px-4 py-3.5">{language === "en" ? "Club / Affiliation" : "Câu lạc bộ"}</th>
              <th className="px-4 py-3.5">{language === "en" ? "Role / Access" : "Quyền hạn"}</th>
              <th className="px-4 py-3.5 text-center">{language === "en" ? "Actions" : "Hành động"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-850 font-sans">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 font-bold bg-white dark:bg-slate-900">
                  {language === "en" ? "No members found match your search criteria." : "Không tìm thấy thành viên nào phù hợp."}
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr 
                  key={user.uid}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors bg-white dark:bg-slate-900"
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      {user.photoURL ? (
                        <img 
                          src={user.photoURL} 
                          alt={user.displayName}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-slate-700 shrink-0 shadow-xs" 
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black shrink-0 uppercase text-sm border border-indigo-200 dark:border-indigo-900">
                          {user.displayName?.charAt(0) || "U"}
                        </div>
                      )}
                      <div>
                        <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                          {user.displayName}
                        </div>
                        <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5 font-semibold">
                          <Mail className="w-3 h-3 text-gray-400" />
                          {user.email || "spectator@vsc.org"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[10px] text-gray-400 font-extrabold break-all">
                    {user.uid}
                  </td>
                  <td className="px-4 py-3.5">
                    {user.club ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-955/20 text-emerald-700 dark:text-emerald-400 rounded-lg font-black tracking-wide border border-emerald-100 dark:border-emerald-950/30">
                        {user.club}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic font-semibold">{language === "en" ? "Unaffiliated" : "Chưa cập nhật"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {user.role === "admin" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 dark:bg-rose-955/20 text-rose-700 dark:text-rose-400 rounded-lg font-black border border-rose-100 dark:border-rose-900/30 uppercase tracking-wide">
                        <Shield className="w-3 h-3 text-rose-500 fill-rose-500/10" />
                        Admin
                      </span>
                    ) : user.role === "referee" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 dark:bg-amber-955/20 text-amber-700 dark:text-amber-400 rounded-lg font-black border border-amber-100 dark:border-amber-900/30 uppercase tracking-wide">
                        <Award className="w-3 h-3 text-amber-500" />
                        Trọng tài
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-955/20 text-indigo-700 dark:text-indigo-400 rounded-lg font-black border border-indigo-100 dark:border-indigo-900/30 uppercase tracking-wide">
                        User
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleStartEdit(user)}
                        className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg text-indigo-600 dark:text-indigo-400 hover:text-indigo-750 transition-all cursor-pointer inline-flex items-center gap-1 font-bold text-[11px]"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>{language === "en" ? "Edit" : "Sửa"}</span>
                      </button>

                      <button
                        onClick={() => {
                          setDeletingUser(user);
                          setSuccessMsg("");
                          setErrorMsg("");
                        }}
                        disabled={user.uid === currentUser?.uid}
                        className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-rose-600 dark:text-rose-400 hover:text-rose-750 transition-all cursor-pointer inline-flex items-center gap-1 font-bold disabled:opacity-30 disabled:pointer-events-none text-[11px]"
                        title={user.uid === currentUser?.uid ? (language === "en" ? "You cannot delete yourself" : "Không thể tự xóa chính mình") : ""}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{language === "en" ? "Delete" : "Xóa"}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal Dialog */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-[10005] p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full overflow-hidden flex flex-col relative text-left">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-150 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-950">
              <div>
                <h4 className="text-sm sm:text-base font-black uppercase text-slate-900 dark:text-white tracking-wide">
                  {language === "en" ? "Edit Member Profile" : "Chỉnh Sửa Thành Viên"}
                </h4>
                <p className="text-[10px] text-gray-550 font-bold uppercase tracking-wider mt-0.5">
                  {editingUser.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg text-gray-400 hover:text-gray-650 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 font-sans">
              {/* Name */}
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                  {language === "en" ? "Display Name" : "Tên hiển thị"}
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-505 font-bold text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* Photo */}
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                  {language === "en" ? "Avatar Photo URL" : "Liên kết ảnh đại diện (URL)"}
                </label>
                <input
                  type="url"
                  value={editPhoto}
                  onChange={(e) => setEditPhoto(e.target.value)}
                  placeholder="https://example.com/avatar.png"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-505 font-bold text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>

              {/* Club */}
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                  {language === "en" ? "Club" : "Tên Câu lạc bộ"}
                </label>
                <input
                  type="text"
                  value={editClub}
                  onChange={(e) => setEditClub(e.target.value)}
                  placeholder="e.g. Slingshot Club A"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-505 font-bold text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* Authority Role */}
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                  {language === "en" ? "Authority Role" : "Cấp bậc / Quyền hạn"}
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-505 font-black text-xs text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value="user">User</option>
                  <option value="referee">Trọng tài (Referee)</option>
                  <option value="admin">Quản trị viên (Admin)</option>
                </select>
              </div>

              {/* Feedback messages */}
              {successMsg && (
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl p-3 text-xs leading-relaxed border border-emerald-100 dark:border-emerald-900/30">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}
              {errorMsg && (
                <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl p-3 text-xs leading-relaxed border border-rose-100 dark:border-rose-900/30">
                  <X className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 rounded-xl text-xs font-bold transition-all cursor-pointer border border-gray-200 dark:border-slate-700"
                >
                  {language === "en" ? "Cancel" : "Hủy bỏ"}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md hover:scale-[1.01] active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (language === "en" ? "Saving..." : "Đang lưu...") : (language === "en" ? "Save Changes" : "Lưu thay đổi")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal Dialog */}
      {deletingUser && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-[10006] p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-rose-100 dark:border-rose-950/30 shadow-2xl max-w-md w-full overflow-hidden flex flex-col relative text-left">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-rose-50 dark:border-rose-950/20 flex justify-between items-center bg-rose-50/50 dark:bg-rose-950/10">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                <h4 className="text-sm sm:text-base font-black uppercase text-rose-700 dark:text-rose-400 tracking-wide">
                  {language === "en" ? "Delete Member Account?" : "Xác Nhận Xóa Thành Viên?"}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-950/30 rounded-lg text-rose-400 hover:text-rose-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 font-sans">
              <div className="text-center p-4 bg-rose-50/50 dark:bg-rose-955/10 border border-rose-100 dark:border-rose-950/20 rounded-2xl">
                <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                  {deletingUser.displayName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {deletingUser.email}
                </p>
                <p className="text-[10px] font-mono text-gray-400 mt-1 break-all uppercase">
                  UID: {deletingUser.uid}
                </p>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
                {language === "en"
                  ? "Warning: Deleting this member's profile is a destructive operation. All of their associated creator authority details and record linkings will be permanently removed."
                  : "Cảnh báo: Hành động xóa hồ sơ thành viên này là không thể hoàn tác. Toàn bộ thông tin cấp bậc, phân quyền câu lạc bộ của họ sẽ bị loại bỏ vĩnh viễn khỏi hệ thống."}
              </p>

              {/* Feedback messages */}
              {successMsg && (
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl p-3 text-xs leading-relaxed border border-emerald-100 dark:border-emerald-900/30">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}
              {errorMsg && (
                <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl p-3 text-xs leading-relaxed border border-rose-100 dark:border-rose-900/30">
                  <X className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingUser(null)}
                  className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 rounded-xl text-xs font-bold transition-all cursor-pointer border border-gray-200 dark:border-slate-700"
                >
                  {language === "en" ? "Cancel" : "Hủy bỏ"}
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={loading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md hover:scale-[1.01] active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {loading ? (language === "en" ? "Deleting..." : "Đang xóa...") : (language === "en" ? "Delete Permanently" : "Xóa vĩnh viễn")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
