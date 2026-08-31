import React from "react";
import { Modal } from "@/components/ui/modal";
import { KeyRound, Shield, CheckCircle2, User } from "lucide-react";

interface RevealIdentityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
  currentPersona?: string;
  realName?: string;
}

export function RevealIdentityModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
  currentPersona,
  realName,
}: RevealIdentityModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reveal your profile?"
      subtitle="Share who you are with your roommates"
      icon={<KeyRound size={20} className="text-amber-400" />}
      iconBg="rgba(217, 119, 6, 0.15)"
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
            Keep Anonymous
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5 shadow-xs"
            style={{
              background: "var(--color-primary)",
              color: "var(--color-primary-fg)",
            }}
          >
            <KeyRound size={13} />
            <span>{isSubmitting ? "Revealing…" : "Reveal Profile"}</span>
          </button>
        </>
      }
    >
      <div className="space-y-3.5 pt-1 text-xs">
        <p className="text-[var(--color-fg)] opacity-90 leading-relaxed">
          Revealing your profile removes your anonymous animal persona and unlocks your verified identity in this room.
        </p>

        <div
          className="rounded-xl p-3 space-y-2 border"
          style={{
            background: "var(--color-surface2)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="flex items-center gap-2 text-amber-300 font-medium">
            <CheckCircle2 size={14} />
            <span>What happens next:</span>
          </div>
          <ul className="space-y-1.5 pl-5 list-disc opacity-80 leading-normal">
            <li>
              Your persona {currentPersona && <strong>({currentPersona})</strong>} changes to your real name {realName && <strong>({realName})</strong>}.
            </li>
            <li>Your bio, avatar, and social links become visible in the room.</li>
            <li>You receive a verified gold badge on chat bubbles and wall posts.</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
