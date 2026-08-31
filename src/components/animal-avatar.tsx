import React from "react";
import { getAvatarChoiceByUrl } from "@/lib/avatar-choices";

interface AnimalAvatarProps {
  animal?: string;
  color?: string;
  size?: number;
  revealed?: boolean;
  displayName?: string | null;
  profileImageUrl?: string | null;
  online?: boolean;
  className?: string;
}

function AnimalIcon({ animal, size = 16 }: { animal?: string; size?: number }) {
  const s = size;
  const strokeProps = {
    width: s,
    height: s,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (animal?.toLowerCase()) {
    case "fox":
      return (
        <svg {...strokeProps}>
          <polygon points="4 4 9 10 3 13 4 4" />
          <polygon points="20 4 15 10 21 13 20 4" />
          <polygon points="9 10 15 10 12 17 9 10" />
          <path d="M12 17v3" />
        </svg>
      );
    case "cat":
      return (
        <svg {...strokeProps}>
          <path d="M4 8l3-4 4 2 2-2 3 4" />
          <path d="M12 19c4.418 0 8-3.582 8-8 0-4-3-7-8-7s-8 3-8 7c0 4.418 3.582 8 8 8z" />
          <path d="M9 13v.01" />
          <path d="M15 13v.01" />
          <path d="M12 16a2 2 0 0 1-2-1h4a2 2 0 0 1-2 1z" />
        </svg>
      );
    case "owl":
      return (
        <svg {...strokeProps}>
          <circle cx="8" cy="10" r="3" />
          <circle cx="16" cy="10" r="3" />
          <path d="M12 11l-1 2h2l-1-2z" />
          <path d="M12 3a9 9 0 0 0-9 9c0 5 4 9 9 9s9-4 9-9a9 9 0 0 0-9-9z" />
          <path d="M4 6l3 2M20 6l-3 2" />
        </svg>
      );
    case "bear":
      return (
        <svg {...strokeProps}>
          <circle cx="6" cy="6" r="3" />
          <circle cx="18" cy="6" r="3" />
          <path d="M12 21a8 8 0 0 0 8-8c0-4-3.5-7-8-7s-8 3-8 7a8 8 0 0 0 8 8z" />
          <ellipse cx="12" cy="15" rx="3.5" ry="2.5" />
          <path d="M12 13.5v1" />
        </svg>
      );
    case "frog":
      return (
        <svg {...strokeProps}>
          <circle cx="7" cy="8" r="3" />
          <circle cx="17" cy="8" r="3" />
          <path d="M4 14c0 4 3.5 7 8 7s8-3 8-7c0-3-3-5-8-5s-8 2-8 5z" />
          <path d="M8 16c2 1 6 1 8 0" />
        </svg>
      );
    case "hare":
    case "rabbit":
      return (
        <svg {...strokeProps}>
          <path d="M8 3c0 4 1.5 7 4 7s4-3 4-7c-1.5 0-3 1.5-4 4-1-2.5-2.5-4-4-4z" />
          <path d="M12 11a6 6 0 0 0-6 6c0 3 2.5 5 6 5s6-2 6-5a6 6 0 0 0-6-6z" />
          <circle cx="10" cy="15" r=".5" fill="currentColor" />
          <circle cx="14" cy="15" r=".5" fill="currentColor" />
        </svg>
      );
    case "penguin":
      return (
        <svg {...strokeProps}>
          <path d="M12 3a6 6 0 0 0-6 6v7c0 3 2.5 5 6 5s6-2 6-5V9a6 6 0 0 0-6-6z" />
          <path d="M6 12l-2 3 2 1M18 12l2 3-2 1" />
          <path d="M12 8l-1.5 2h3L12 8z" />
        </svg>
      );
    case "moth":
      return (
        <svg {...strokeProps}>
          <path d="M12 8v10M12 5l-2-2M12 5l2-2" />
          <path d="M12 10c-3-4-8-3-9 2s4 6 9 3c5 3 10 1 9-3s-6-6-9-2z" />
        </svg>
      );
    case "sparrow":
    case "bird":
      return (
        <svg {...strokeProps}>
          <path d="M16 7l3 1-2 2" />
          <path d="M4 15c4 0 7-3 8-7 4 2 8 2 9 0 0 6-4 10-10 10a9 9 0 0 1-7-3z" />
        </svg>
      );
    default:
      return (
        <svg {...strokeProps}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="9" cy="10" r="1" fill="currentColor" />
          <circle cx="15" cy="10" r="1" fill="currentColor" />
          <path d="M9.5 15a3.5 3.5 0 0 0 5 0" />
        </svg>
      );
  }
}

export function AnimalAvatar({
  animal,
  color,
  size = 32,
  revealed,
  displayName,
  profileImageUrl,
  online,
  className = "",
}: AnimalAvatarProps) {
  const iconSize = Math.round(size * 0.55);
  const avatarChoice = profileImageUrl ? getAvatarChoiceByUrl(profileImageUrl) : null;
  const borderOrBgColor = avatarChoice?.color ?? color;

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      {revealed && profileImageUrl ? (
        <div
          className="w-full h-full rounded-full overflow-hidden border p-0.5 flex items-center justify-center shadow-xs"
          style={{ borderColor: borderOrBgColor ?? "var(--color-border)", background: "var(--color-surface2)" }}
        >
          <img
            src={profileImageUrl}
            alt={displayName || "User"}
            className="w-full h-full object-contain rounded-full"
          />
        </div>
      ) : revealed && displayName ? (
        <div
          className="w-full h-full rounded-full flex items-center justify-center font-bold text-xs shadow-xs"
          style={{
            background: borderOrBgColor ?? "var(--color-primary)",
            color: "#ffffff",
          }}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
      ) : (
        <div
          className="w-full h-full rounded-full flex items-center justify-center shadow-xs transition-transform"
          style={{
            background: `linear-gradient(135deg, ${color}dd, ${color})`,
            color: "#ffffff",
          }}
          title={animal}
        >
          <AnimalIcon animal={animal} size={iconSize} />
        </div>
      )}

      {online !== undefined && (
        <span
          className="absolute -bottom-0.5 -right-0.5 rounded-full border-2"
          style={{
            width: Math.max(7, Math.round(size * 0.3)),
            height: Math.max(7, Math.round(size * 0.3)),
            background: online ? "var(--color-accent)" : "rgba(255,255,255,0.2)",
            borderColor: "var(--color-bg)",
          }}
        />
      )}
    </div>
  );
}
