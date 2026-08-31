import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Plus, Search, Smile } from "lucide-react";

export function emojiToHex(emoji: string): string {
  const codePoints: string[] = [];
  for (const char of emoji) {
    const cp = char.codePointAt(0);
    // Skip variation selectors (0xfe0f, 0xfe0e) and joiners if standalone
    if (cp && cp !== 0xfe0f && cp !== 0xfe0e && cp !== 0x200d) {
      codePoints.push(cp.toString(16).toLowerCase());
    }
  }
  return codePoints.join("-");
}

export function AppleEmoji({
  emoji,
  size = 18,
  className = "",
}: {
  emoji: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const hex = emojiToHex(emoji);
  const cdnUrl = `https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/${hex}.png`;

  if (failed || !hex) {
    return (
      <span
        style={{ fontSize: `${size * 0.85}px` }}
        className={`inline-block select-none leading-none align-middle ${className}`}
      >
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={cdnUrl}
      alt={emoji}
      onError={() => setFailed(true)}
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`inline-block object-contain select-none align-middle ${className}`}
      loading="lazy"
    />
  );
}

export const DEFAULT_REACTIONS = ["❤️", "😂", "😢", "😮", "😡"];

export const POPULAR_EMOJIS = [
  // Defaults
  "❤️", "😂", "😢", "😮", "😡",
  // Joy & Love
  "🥰", "😍", "🤩", "😎", "🥳", "😭", "💀", "🤣", "🥺", "😊", "🤗", "😇", "😴",
  // Hands & Gestures
  "👍", "👎", "👏", "🙌", "🤝", "🙏", "💯", "🔥", "✨", "🫶", "✌️", "🫡", "💪",
  // Fun & Vibe
  "🎉", "☕", "🧋", "🍕", "🎸", "🎵", "🚀", "💌", "🎯", "🎈", "🎁", "⭐", "🌈",
];

export function EmojiPickerModal({
  isOpen,
  onClose,
  onSelectEmoji,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? POPULAR_EMOJIS.filter((e) => e.includes(search.trim()))
    : POPULAR_EMOJIS;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="React with Emoji"
      subtitle="Choose an iOS emoji reaction"
      icon={<Smile size={18} className="text-amber-400" />}
      iconBg="rgba(245, 158, 11, 0.15)"
    >
      <div className="space-y-3 pt-1">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type or paste any emoji…"
            className="w-full rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-1 border"
            style={{
              background: "var(--color-surface2)",
              color: "var(--color-fg)",
              borderColor: "var(--color-border)",
            }}
          />
        </div>

        <div className="grid grid-cols-7 gap-2 max-h-60 overflow-y-auto p-1">
          {filtered.map((e, idx) => (
            <button
              key={`${e}-${idx}`}
              type="button"
              onClick={() => {
                onSelectEmoji(e);
                onClose();
              }}
              className="p-2 rounded-xl border flex items-center justify-center transition-all hover:scale-110 hover:bg-neutral-800 cursor-pointer"
              style={{
                background: "var(--color-surface2)",
                borderColor: "var(--color-border)",
              }}
            >
              <AppleEmoji emoji={e} size={22} />
            </button>
          ))}
        </div>

        {search.trim() && !filtered.includes(search.trim()) && (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => {
                onSelectEmoji(search.trim());
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 hover:bg-neutral-800"
              style={{
                background: "var(--color-surface2)",
                borderColor: "var(--color-border)",
                color: "var(--color-fg)",
              }}
            >
              <span>React with</span>
              <AppleEmoji emoji={search.trim()} size={16} />
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
