import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "vi" | "en";

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, overrideDefault?: string) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

const TRANSLATIONS: Record<Language, Record<string, string>> = {
  vi: {
    // Header
    "app.title": "Vietnam Slingshot Championship",
    "app.vsc_official": "VSC OFFICIAL",
    "app.version": "App v2.5 Premium",
    "app.offline_mode": "Ngoại tuyến (Lưu Cache)",
    "app.syncing": "Đang đồng bộ Cloud...",
    "app.sync_ok": "Đồng bộ Cloud OK",
    "app.guest_mode": "Chế độ Khách (Spectator)",
    "app.exit_tournament": "Thoát Giải Đấu",
    "app.share_tournament": "Chia sẻ giải đấu",
    "app.copied_link": "Đã copy link!",
    "app.viewing_tournament": "Đang xem giải: ",

    // Tabs
    "tab.leaderboard": "Bảng Thành Tích",
    "tab.live_board": "Bảng Điểm Live",
    "tab.athletes": "Quản Lý VĐV",
    "tab.settings": "Cấu Hình Giải",
    "tab.history": "Lịch Sử Sao Lưu",
    "tab.control_panel": "My Control Panel",

    // Dashboard & Leaderboard General
    "dashboard.overview": "Toàn Cảnh",
    "dashboard.stats": "Thống Kê",
    "dashboard.individual": "Cá Nhân",
    "dashboard.team": "Đồng Đội",
    "dashboard.survival": "Sinh Tồn (Survival)",
    "dashboard.search_placeholder": "Tìm kiếm vđv, đội thi đấu...",
    "dashboard.all_provinces": "Tất cả Tỉnh Thành",
    "dashboard.all_genders": "Mọi giới tính",
    "dashboard.all_clubs": "Tất cả Câu Lạc Bộ",
    "dashboard.male": "Nam",
    "dashboard.female": "Nữ",
    "dashboard.individual_mode": "Thi Cá Nhân",
    "dashboard.team_mode": "Thi Đồng Đội",
    "dashboard.combined_mode": "Cá Nhân & Đồng Đội (Kết Hợp)",
    "dashboard.status_competing": "Thi đấu",
    "dashboard.status_withdrawn": "Bỏ thi",

    // Table Headers
    "table.rank": "Hạng",
    "table.athlete": "Vận Động Viên",
    "table.club_province": "CLB / Tỉnh Thành",
    "table.gender": "G.Tính",
    "table.total_score": "Tổng Điểm",
    "table.hits": "Số Chạm",
    "table.accuracy": "Tỷ Lệ Chạm",
    "table.action": "Hành động",
    "table.team_name": "Tên Đội / Đơn Vị",
    "table.team_members": "Thành viên đội",

    // Live Scoring
    "live.enter_score": "Nhập Điểm Trực Tiếp",
    "live.referee": "Trọng tài",
    "live.select_athlete": "Chọn VĐV thi đấu",
    "live.confirm_score": "Xác nhận điểm số",
    "live.clear_score": "Xóa điểm vòng này",
    "live.save": "Lưu điểm số",
    "live.next_athlete": "VĐV Tiếp Theo",

    // Athlete Management
    "athlete.title": "Danh Sách Vận Động Viên",
    "athlete.add_new": "Thêm Vận Động Viên",
    "athlete.fullname": "Họ và tên",
    "athlete.club": "Câu Lạc Bộ",
    "athlete.province": "Tỉnh thành",
    "athlete.gender_select": "Chọn giới tính",
    "athlete.id_card": "Số báo danh / ID",
    "athlete.dob": "Ngày sinh",
    "athlete.save_athlete": "Lưu Vận Động Viên",
    "athlete.drag_drop_hint": "Ngoài việc có nút lên xuống để di chuyển thứ tự vđv, hãy cho tôi có thể Drag kéo thả vị trí danh sách vđv.",
    "athlete.drag_hint_short": "Kéo thả để sắp xếp danh sách vđv",

    // Settings
    "settings.title": "Cấu Hình Giải Đấu & Trọng Tài",
    "settings.distances": "Cấu hình cự ly bắn",
    "settings.add_distance": "Thêm cự ly",
    "settings.distance_name": "Tên cự ly",
    "settings.multiplier": "Hệ số điểm",
    "settings.max_score_checkbox": "MAX điểm các vòng",
    "settings.scoring_rules": "Cấu hình tính điểm nâng cao",
    "settings.cloud_publish": "Đăng Online (Cloud Sync)",
    "settings.save_config": "Lưu cấu hình",

    // Footer
    "footer.media": "Kênh Truyền Thông & Nhóm Đăng Ký",
    "footer.sponsors": "Đơn Vị Đồng Hành & Câu Lạc Bộ Tài Trợ",
    "footer.copyright": "Hệ thống tính điểm mục tiêu bộ môn thể thao Ná Cao Su © 2026 bởi #HiepNAT",
    "footer.storage_hint": "Dữ liệu được lưu trữ tự động vào trình lưu trữ cục bộ của bạn (LocalStorage). Bạn có thể sao lưu thủ công bất cứ lúc nào qua tab \"Cấu Hình\".",

    // Shared / Buttons / Dialogs
    "btn.close": "Đóng",
    "btn.cancel": "Hủy",
    "btn.confirm": "Xác nhận",
    "btn.save": "Lưu",
    "btn.edit": "Sửa",
    "btn.delete": "Xóa",
    "btn.add": "Thêm mới",
    "btn.import": "Nhập tệp",
    "btn.export": "Xuất tệp",
    "btn.share": "Chia sẻ"
  },
  en: {
    // Header
    "app.title": "Vietnam Slingshot Championship",
    "app.vsc_official": "VSC OFFICIAL",
    "app.version": "App v2.5 Premium",
    "app.offline_mode": "Offline (Cached Mode)",
    "app.syncing": "Syncing with Cloud...",
    "app.sync_ok": "Cloud Sync OK",
    "app.guest_mode": "Guest Mode (Spectator)",
    "app.exit_tournament": "Exit Tournament",
    "app.share_tournament": "Share Tournament",
    "app.copied_link": "Link copied!",
    "app.viewing_tournament": "Viewing: ",

    // Tabs
    "tab.leaderboard": "Leaderboard",
    "tab.live_board": "Live Scoring",
    "tab.athletes": "Roster Management",
    "tab.settings": "Settings & Config",
    "tab.history": "Backup History",
    "tab.control_panel": "My Control Panel",

    // Dashboard & Leaderboard General
    "dashboard.overview": "Overview",
    "dashboard.stats": "Analytics & Stats",
    "dashboard.individual": "Individual",
    "dashboard.team": "Team Standings",
    "dashboard.survival": "Survival Mode",
    "dashboard.search_placeholder": "Search athletes, teams...",
    "dashboard.all_provinces": "All Provinces",
    "dashboard.all_genders": "All Genders",
    "dashboard.all_clubs": "All Clubs",
    "dashboard.male": "Male",
    "dashboard.female": "Female",
    "dashboard.individual_mode": "Individual Match",
    "dashboard.team_mode": "Team Match",
    "dashboard.combined_mode": "Individual & Team (Combined)",
    "dashboard.status_competing": "Competing",
    "dashboard.status_withdrawn": "Withdrawn",

    // Table Headers
    "table.rank": "Rank",
    "table.athlete": "Athlete",
    "table.club_province": "Club / Province",
    "table.gender": "Gender",
    "table.total_score": "Total Score",
    "table.hits": "Hits",
    "table.accuracy": "Accuracy %",
    "table.action": "Action",
    "table.team_name": "Team / Unit Name",
    "table.team_members": "Team Members",

    // Live Scoring
    "live.enter_score": "Enter Live Score",
    "live.referee": "Referee",
    "live.select_athlete": "Select Active Athlete",
    "live.confirm_score": "Confirm Scores",
    "live.clear_score": "Clear This Round",
    "live.save": "Save Scores",
    "live.next_athlete": "Next Athlete",

    // Athlete Management
    "athlete.title": "Athlete Roster",
    "athlete.add_new": "Add New Athlete",
    "athlete.fullname": "Full Name",
    "athlete.club": "Club",
    "athlete.province": "Province/City",
    "athlete.gender_select": "Select Gender",
    "athlete.id_card": "Bib / ID Number",
    "athlete.dob": "Date of Birth",
    "athlete.save_athlete": "Save Athlete",
    "athlete.drag_drop_hint": "In addition to using up/down buttons to reorder, you can drag and drop roster items directly.",
    "athlete.drag_hint_short": "Drag & drop to reorder athletes",

    // Settings
    "settings.title": "Tournament & Referee Config",
    "settings.distances": "Distance Configurations",
    "settings.add_distance": "Add Distance",
    "settings.distance_name": "Distance label",
    "settings.multiplier": "Multiplier",
    "settings.max_score_checkbox": "MAX point of rounds",
    "settings.scoring_rules": "Advanced Scoring Rules",
    "settings.cloud_publish": "Publish Online (Cloud Sync)",
    "settings.save_config": "Save Config",

    // Footer
    "footer.media": "Media & Registration channels",
    "footer.sponsors": "Sponsors & Sponsoring Clubs",
    "footer.copyright": "Slingshot target sport scoring system © 2026 by #HiepNAT",
    "footer.storage_hint": "Data is automatically synchronized to your local workspace (LocalStorage). You can backup manually anytime under the \"Settings\" tab.",

    // Shared / Buttons / Dialogs
    "btn.close": "Close",
    "btn.cancel": "Cancel",
    "btn.confirm": "Confirm",
    "btn.save": "Save",
    "btn.edit": "Edit",
    "btn.delete": "Delete",
    "btn.add": "Add New",
    "btn.import": "Import File",
    "btn.export": "Export File",
    "btn.share": "Share"
  }
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem("slingshot_language") as Language) || "vi";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("slingshot_language", lang);
  };

  const t = (key: string, overrideDefault?: string): string => {
    const translation = TRANSLATIONS[language][key];
    if (translation) return translation;
    return overrideDefault || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
