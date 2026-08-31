import React from "react";
import { Modal } from "@/components/ui/modal";
import { Disc3, Unlink, KeyRound, Search, CheckCircle2 } from "lucide-react";

interface SpotifySetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SpotifySetupModal({ isOpen, onClose }: SpotifySetupModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Connect Spotify Account"
      subtitle="Sync your live Spotify playback with roommates"
      icon={<Disc3 size={20} className="text-emerald-400" />}
      iconBg="rgba(30, 215, 96, 0.15)"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-90"
          style={{
            background: "var(--color-primary)",
            color: "var(--color-primary-fg)",
          }}
        >
          Got it
        </button>
      }
    >
      <div className="space-y-3.5 text-xs">
        <div
          className="rounded-xl p-3 space-y-1.5 border"
          style={{
            background: "rgba(30, 215, 96, 0.08)",
            borderColor: "rgba(30, 215, 96, 0.25)",
          }}
        >
          <div className="flex items-center gap-2 font-medium text-emerald-400">
            <Search size={14} />
            <span>Instant Search is already active!</span>
          </div>
          <p className="opacity-80 leading-relaxed">
            You can already search any track or paste links in the Music tab with zero setup.
          </p>
        </div>

        <p className="opacity-90 leading-relaxed">
          To enable live <strong>"Now Playing"</strong> background sync from your real Spotify app, add your Spotify Developer keys to your <code>.env</code> file:
        </p>

        <div
          className="rounded-xl p-3 font-mono text-[11px] space-y-1 border"
          style={{
            background: "var(--color-surface2)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="text-neutral-400"># In your .env file:</div>
          <div className="text-amber-300">SPOTIFY_CLIENT_ID=&quot;your_id&quot;</div>
          <div className="text-amber-300">SPOTIFY_CLIENT_SECRET=&quot;your_secret&quot;</div>
        </div>
      </div>
    </Modal>
  );
}

interface SpotifyDisconnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export function SpotifyDisconnectModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
}: SpotifyDisconnectModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Disconnect Spotify?"
      subtitle="Remove Spotify account link from Roomies"
      icon={<Unlink size={20} className="text-rose-400" />}
      iconBg="rgba(244, 63, 94, 0.15)"
      footer={
        <>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-neutral-800 border"
            style={{
              color: "var(--color-muted)",
              borderColor: "var(--color-border)",
              background: "var(--color-surface2)",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5 shadow-xs bg-rose-600 hover:bg-rose-500 text-white"
          >
            <Unlink size={13} />
            <span>{isSubmitting ? "Disconnecting…" : "Disconnect"}</span>
          </button>
        </>
      }
    >
      <p className="text-xs text-[var(--color-fg)] opacity-90 leading-relaxed">
        This will disconnect your Spotify account. Your live *"Now Playing"* track will no longer be shared in room sessions. You can reconnect at any time.
      </p>
    </Modal>
  );
}
