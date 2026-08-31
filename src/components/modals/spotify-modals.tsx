import React from "react";
import { Modal } from "@/components/ui/modal";
import { Disc3, Unlink, CheckCircle2, Music2 } from "lucide-react";

interface SpotifySetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SpotifySetupModal({ isOpen, onClose }: SpotifySetupModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Music Player & Search"
      subtitle="Listen and share music with your roommates"
      icon={<Disc3 size={20} className="text-emerald-400" />}
      iconBg="rgba(30, 215, 96, 0.15)"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2 rounded-xl text-xs font-semibold hover:opacity-90 cursor-pointer shadow-xs"
          style={{
            background: "var(--color-primary)",
            color: "var(--color-primary-fg)",
          }}
        >
          Start Listening
        </button>
      }
    >
      <div className="space-y-3.5 text-xs">
        <div
          className="rounded-2xl p-4 space-y-2 border shadow-xs"
          style={{
            background: "rgba(30, 215, 96, 0.08)",
            borderColor: "rgba(30, 215, 96, 0.25)",
          }}
        >
          <div className="flex items-center gap-2 font-semibold text-emerald-400 text-sm">
            <CheckCircle2 size={16} />
            <span>Music Search & 30s Previews Ready!</span>
          </div>
          <p className="opacity-90 leading-relaxed text-xs">
            You can search any song or artist in the Music tab, tap album covers to play 30-second audio previews, and share tracks instantly with your roommates.
          </p>
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
      title="Disconnect Spotify"
      subtitle="Are you sure you want to disconnect Spotify?"
      icon={<Unlink size={20} className="text-rose-400" />}
      iconBg="rgba(244, 63, 94, 0.15)"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold border hover:bg-neutral-800 transition-colors"
            style={{ borderColor: "var(--color-border)", color: "var(--color-fg)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 transition-colors shadow-xs"
          >
            {isSubmitting ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      }
    >
      <p className="text-xs leading-relaxed opacity-80">
        Disconnecting will stop syncing your live Spotify playing activity with your roommates.
      </p>
    </Modal>
  );
}
