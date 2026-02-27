import { cn } from "@/lib/utils";

interface NestAvatarProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

/**
 * Avatar da Nest — assistente de IA do ClinicNest.
 * Pássaro estilizado em teal com elementos de IA.
 */
export function NestAvatar({ size = 80, className, animate = false }: NestAvatarProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(animate && "animate-bounce-slow", className)}
      aria-label="Nest — Assistente de IA"
    >
      {/* Background circle */}
      <circle cx="60" cy="60" r="58" fill="url(#nest-bg)" />
      <circle cx="60" cy="60" r="58" stroke="url(#nest-ring)" strokeWidth="2" />

      {/* Soft glow */}
      <circle cx="60" cy="60" r="50" fill="white" opacity="0.06" />

      {/* Nest (woven twigs at bottom) */}
      <path
        d="M34 82 Q36 76, 42 80 Q48 76, 54 80 Q60 76, 66 80 Q72 76, 78 80 Q84 76, 86 82"
        stroke="#a16207"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M36 86 Q60 96, 84 86"
        stroke="#92400e"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />

      {/* Bird body */}
      <ellipse cx="60" cy="64" rx="22" ry="20" fill="white" opacity="0.95" />

      {/* Belly highlight */}
      <ellipse cx="60" cy="68" rx="14" ry="12" fill="#f0fdfa" opacity="0.6" />

      {/* Bird head */}
      <circle cx="60" cy="42" r="18" fill="white" opacity="0.97" />

      {/* Left eye */}
      <circle cx="52" cy="40" r="5" fill="#0f766e" />
      <circle cx="53.5" cy="38.5" r="2" fill="white" />

      {/* Right eye */}
      <circle cx="68" cy="40" r="5" fill="#0f766e" />
      <circle cx="69.5" cy="38.5" r="2" fill="white" />

      {/* Happy beak */}
      <path
        d="M56 48 L60 53 L64 48"
        fill="#f59e0b"
        stroke="#d97706"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />

      {/* Left wing */}
      <path
        d="M38 58 C30 50, 32 42, 40 48 C36 54, 38 60, 42 58"
        fill="#99f6e4"
        stroke="#5eead4"
        strokeWidth="1"
      />

      {/* Right wing */}
      <path
        d="M82 58 C90 50, 88 42, 80 48 C84 54, 82 60, 78 58"
        fill="#99f6e4"
        stroke="#5eead4"
        strokeWidth="1"
      />

      {/* AI sparkle top-right */}
      <g opacity="0.7">
        <path
          d="M92 22 L94 16 L96 22 L102 24 L96 26 L94 32 L92 26 L86 24Z"
          fill="#5eead4"
        />
      </g>

      {/* AI sparkle top-left (smaller) */}
      <g opacity="0.5">
        <path
          d="M24 28 L25.5 24 L27 28 L31 29.5 L27 31 L25.5 35 L24 31 L20 29.5Z"
          fill="#5eead4"
        />
      </g>

      {/* AI circuit dots */}
      <circle cx="18" cy="60" r="2" fill="#5eead4" opacity="0.4" />
      <circle cx="102" cy="60" r="2" fill="#5eead4" opacity="0.4" />
      <circle cx="60" cy="102" r="2" fill="#5eead4" opacity="0.35" />

      {/* Small headset/antenna for AI feel */}
      <path
        d="M48 28 C48 20, 60 16, 60 16 C60 16, 72 20, 72 28"
        stroke="#5eead4"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <circle cx="60" cy="15" r="3" fill="#2dd4bf" opacity="0.7" />

      <defs>
        <linearGradient id="nest-bg" x1="10" y1="10" x2="110" y2="110">
          <stop offset="0%" stopColor="#0d9488" />
          <stop offset="50%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
        <linearGradient id="nest-ring" x1="0" y1="0" x2="120" y2="120">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="100%" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>
    </svg>
  );
}
