import * as React from "react";

export const BbotTokenIcon = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="10" cy="10" r="9" stroke="#FFD700" strokeWidth="2" fill="#FFF8DC" />
    <text
      x="50%"
      y="55%"
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize="10"
      fontWeight="bold"
      fill="#FFD700"
      fontFamily="Arial, sans-serif"
    >
      B
    </text>
  </svg>
); 