import React from "react";
import { Heart, Flame, Smile, Sparkles, MessageSquareQuote } from "lucide-react";

export const REACTION_TYPES = [
  { kind: "heart", label: "Warmth", Icon: Heart },
  { kind: "flame", label: "Fire", Icon: Flame },
  { kind: "smile", label: "Laugh", Icon: Smile },
  { kind: "sparkles", label: "Inspire", Icon: Sparkles },
  { kind: "quote", label: "Relatable", Icon: MessageSquareQuote },
] as const;

export type ReactionKind = (typeof REACTION_TYPES)[number]["kind"];

interface ReactionButtonProps {
  kind: string;
  count: number;
  mine: boolean;
  onClick: () => void;
}

export function ReactionButton({ kind, count, mine, onClick }: ReactionButtonProps) {
  const match = REACTION_TYPES.find((r) => r.kind === kind) || {
    kind,
    label: kind,
    Icon: Heart,
  };
  const { Icon, label } = match;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all active:scale-95 border ${
        mine
          ? "bg-amber-950/40 border-amber-500/50 text-amber-300 shadow-xs"
          : "bg-[var(--color-surface2)] border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-neutral-600"
      }`}
      title={`${label} (${count})`}
    >
      <Icon
        size={13}
        className={`transition-transform stroke-[1.8] ${
          mine
            ? kind === "heart"
              ? "fill-amber-400 stroke-amber-400"
              : kind === "flame"
              ? "fill-orange-400 stroke-orange-400"
              : kind === "sparkles"
              ? "fill-yellow-300 stroke-yellow-300"
              : "stroke-amber-300 stroke-[2.2]"
            : "stroke-current"
        }`}
      />
      {count > 0 && <span className={`text-[11px] font-semibold ${mine ? "text-amber-200" : ""}`}>{count}</span>}
    </button>
  );
}
