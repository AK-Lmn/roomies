import { useState } from "react";
import { Play, ChevronDown, ChevronUp, Music2 } from "lucide-react";

export function getEmbedUrl(rawUrl: string): { type: "spotify" | "youtube" | "other"; embedUrl: string | null } {
  try {
    const u = new URL(rawUrl);

    if (u.hostname.includes("spotify.com")) {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        const type = parts[parts.length - 2];
        const id = parts[parts.length - 1]?.split("?")[0];
        if (["track", "album", "playlist", "episode"].includes(type) && id) {
          return {
            type: "spotify",
            embedUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`,
          };
        }
      }
    }

    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      let videoId: string | null = null;
      if (u.hostname.includes("youtu.be")) {
        videoId = u.pathname.slice(1).split("?")[0];
      } else if (u.pathname.includes("/shorts/")) {
        videoId = u.pathname.split("/shorts/")[1]?.split("?")[0] ?? null;
      } else {
        videoId = u.searchParams.get("v");
      }

      if (videoId) {
        return {
          type: "youtube",
          embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
        };
      }
    }
  } catch {
    // invalid URL format
  }

  return { type: "other", embedUrl: null };
}

function SpotifyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-emerald-400">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.625.625 0 0 1-.86.208c-2.355-1.439-5.32-1.764-8.813-.966a.625.625 0 1 1-.277-1.219c3.823-.873 7.098-.507 9.742 1.117a.625.625 0 0 1 .208.86zm1.226-2.723a.782.782 0 0 1-1.077.258c-2.697-1.657-6.808-2.136-9.998-1.168a.782.782 0 0 1-.456-1.498c3.64-1.106 8.188-.578 11.273 1.33a.782.782 0 0 1 .258 1.078zm.105-2.835C14.686 8.94 8.549 8.736 5.01 9.81a.937.937 0 1 1-.546-1.792c4.073-1.236 10.849-1.002 14.68 1.272a.938.938 0 0 1-1.227 1.424z" />
    </svg>
  );
}

function YouTubeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-rose-500">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function MediaEmbed({ url, title }: { url: string; title: string }) {
  const [expanded, setExpanded] = useState(false);
  const { type, embedUrl } = getEmbedUrl(rawUrlClean(url));

  function rawUrlClean(u: string): string {
    // If it's a youtube search result redirect, extract search or original
    return u;
  }

  if (!embedUrl) {
    return null;
  }

  return (
    <div className="mt-2 space-y-1">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-all border ${
          expanded
            ? "bg-neutral-800 text-white border-neutral-700 shadow-xs"
            : "bg-[var(--color-surface2)] text-[var(--color-fg)] border-[var(--color-border)] hover:bg-neutral-800"
        }`}
      >
        {type === "spotify" ? <SpotifyIcon size={14} /> : <YouTubeIcon size={14} />}
        <span>{type === "spotify" ? "Spotify Player" : "YouTube Video"}</span>
        <span className="opacity-60 flex items-center ml-1">
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>

      {expanded && (
        <div className="rounded-xl overflow-hidden border mt-2 shadow-lg" style={{ borderColor: "var(--color-border)" }}>
          {type === "spotify" ? (
            <iframe
              src={embedUrl}
              width="100%"
              height="152"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              title={title}
              className="rounded-xl"
            />
          ) : (
            <div className="relative aspect-video w-full">
              <iframe
                src={embedUrl}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full rounded-xl"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
