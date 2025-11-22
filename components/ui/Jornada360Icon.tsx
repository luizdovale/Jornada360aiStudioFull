import React from "react";

const Jornada360Icon: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE78A" />
          <stop offset="40%" stopColor="#F9C733" />
          <stop offset="100%" stopColor="#E6A11A" />
        </linearGradient>

        <linearGradient id="highlight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>

        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="6"
            stdDeviation="6"
            floodColor="#D4941E"
            floodOpacity="0.6"
          />
        </filter>
      </defs>

      <g filter="url(#softShadow)">
        <circle
          cx="256"
          cy="256"
          r="190"
          stroke="url(#goldGradient)"
          strokeWidth="36"
          fill="none"
          strokeLinecap="round"
        />

        <circle
          cx="256"
          cy="256"
          r="190"
          stroke="url(#highlight)"
          strokeWidth="18"
          fill="none"
          strokeLinecap="round"
        />

        <circle cx="256" cy="86" r="14" fill="url(#goldGradient)" />
        <circle cx="380" cy="256" r="14" fill="url(#goldGradient)" />
        <circle cx="132" cy="256" r="14" fill="url(#goldGradient)" />

        <rect
          x="242"
          y="130"
          width="28"
          height="140"
          rx="14"
          fill="url(#goldGradient)"
        />

        <rect
          x="256"
          y="242"
          width="120"
          height="28"
          rx="14"
          fill="url(#goldGradient)"
        />

        <circle cx="256" cy="256" r="20" fill="url(#goldGradient)" />
      </g>
    </svg>
  );
};

export default Jornada360Icon;
