import React from "react";

interface LogoProps {
  className?: string;
  size?: number;
}

export const VSCLogo: React.FC<LogoProps> = ({ className = "", size = 48 }) => {
  return (
    <img
      src="https://lh3.googleusercontent.com/d/1CAz9xUSO8XIvtEy9TYqil228Cz-jYcIM"
      alt="VSC Logo"
      style={{ width: size, height: size }}
      className={`${className} object-contain hover:scale-105 transition-transform duration-200`}
      referrerPolicy="no-referrer"
    />
  );
};

export const SlingshotIcon: React.FC<LogoProps> = ({ className = "", size = 48 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} filter drop-shadow-md`}
    >
      {/* Background radial glow */}
      <circle cx="60" cy="60" r="50" fill="url(#circle_glow)" />

      {/* Target bulls-eye background circle lines */}
      <circle cx="60" cy="50" r="30" stroke="rgba(244, 63, 94, 0.25)" strokeWidth="1" strokeDasharray="3,3" />
      <circle cx="60" cy="50" r="18" stroke="rgba(244, 63, 94, 0.4)" strokeWidth="1.5" />
      <circle cx="60" cy="50" r="6" fill="#f43f5e" />

      {/* Slingshot Body (Wood Grain & Gunmetal finish Y-Shape Frame) */}
      {/* Right Fork */}
      <path
        d="M82 40 L70 65 C68 69, 64 73, 60 73"
        stroke="url(#slingshot_body_grad)"
        strokeWidth="8.5"
        strokeLinecap="round"
      />
      {/* Left Fork */}
      <path
        d="M38 40 L50 65 C52 69, 56 73, 60 73"
        stroke="url(#slingshot_body_grad)"
        strokeWidth="8.5"
        strokeLinecap="round"
      />
      {/* Handle */}
      <path
        d="M60 70 L60 102"
        stroke="url(#slingshot_handle_grad)"
        strokeWidth="11"
        strokeLinecap="round"
      />
      {/* Golden Screw/Rings cap on handle */}
      <circle cx="60" cy="74" r="3" fill="#f59e0b" />
      <circle cx="60" cy="94" r="3" fill="#f59e0b" />

      {/* Fork Tips metallic brackets */}
      <rect x="34" y="36" width="8" height="6" rx="1.5" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
      <rect x="78" y="36" width="8" height="6" rx="1.5" fill="#475569" stroke="#94a3b8" strokeWidth="1" />

      {/* Heavy Red Rubber Bands drawn in action tension */}
      {/* Left band */}
      <path
        d="M38 39 L60 50"
        stroke="#f43f5e"
        strokeWidth="3.5"
        strokeLinecap="round"
        className="animate-pulse"
      />
      {/* Right band */}
      <path
        d="M82 39 L60 50"
        stroke="#f43f5e"
        strokeWidth="3.5"
        strokeLinecap="round"
        className="animate-pulse"
      />

      {/* Leather projectile pouch holding bullet */}
      <path
        d="M54 48 C56 46, 64 46, 66 48 L63 53 C62 54, 58 54, 57 53 Z"
        fill="#78350f"
        stroke="#451a03"
        strokeWidth="1"
      />
      
      {/* Shiny silver steel ball projectile loaded inside the pouch */}
      <circle cx="60" cy="50" r="3.5" fill="url(#steel_ball)" />

      {/* Glow gradient definition */}
      <defs>
        <radialGradient id="circle_glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(59, 130, 246, 0.15)" />
          <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
        </radialGradient>
        <linearGradient id="slingshot_body_grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="50%" stopColor="#475569" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="slingshot_handle_grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#78350f" />
          <stop offset="45%" stopColor="#d97706" />
          <stop offset="80%" stopColor="#b45309" />
          <stop offset="100%" stopColor="#451a03" />
        </linearGradient>
        <radialGradient id="steel_ball" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#475569" />
        </radialGradient>
      </defs>
    </svg>
  );
};
