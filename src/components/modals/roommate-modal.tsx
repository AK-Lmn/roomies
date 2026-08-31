import React from "react";
import { Modal } from "@/components/ui/modal";
import { AnimalAvatar } from "@/components/animal-avatar";
import type { RoomView } from "@/lib/types";
import { BadgeCheck, Globe, Instagram, Twitter, KeyRound, Shield, Link2, Sparkles } from "lucide-react";

interface RoommateModalProps {
  member: RoomView["members"][0] | null;
  onClose: () => void;
  onRequestReveal?: () => void;
}

export function RoommateModal({ member, onClose, onRequestReveal }: RoommateModalProps) {
  if (!member) return null;

  const isRevealed = member.revealed && member.profile;
  const isMe = member.isMe;

  return (
    <Modal
      isOpen={Boolean(member)}
      onClose={onClose}
      title={isRevealed && member.profile ? member.profile.displayName : member.tempIdentity}
      subtitle={isRevealed ? `@${member.profile?.username}` : "Anonymous Roommate"}
      icon={
        <AnimalAvatar
          animal={member.identityAnimal}
          color={member.identityColor}
          size={36}
          revealed={member.revealed}
          displayName={member.profile?.displayName}
          profileImageUrl={member.profile?.avatarUrl}
        />
      }
      iconBg={member.identityColor ? `${member.identityColor}25` : "var(--color-surface2)"}
      footer={
        <div className="w-full flex items-center justify-between gap-2">
          {isMe && !member.revealed && onRequestReveal ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onRequestReveal();
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all hover:opacity-90 shadow-xs"
              style={{
                background: "var(--color-primary)",
                color: "var(--color-primary-fg)",
              }}
            >
              <KeyRound size={13} />
              <span>Reveal Profile</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium hover:opacity-80 border transition-colors"
            style={{
              background: "var(--color-surface2)",
              color: "var(--color-fg)",
              borderColor: "var(--color-border)",
            }}
          >
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-3.5 text-xs">
        <div className="flex items-center justify-between p-2.5 rounded-xl border" style={{ background: "var(--color-surface2)", borderColor: "var(--color-border)" }}>
          <span className="opacity-70 flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${member.online ? "bg-emerald-400" : "bg-neutral-500"}`} />
            <span>{member.online ? "Online in Room" : "Offline"}</span>
          </span>
          {isRevealed && (
            <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
              <BadgeCheck size={14} />
              <span>Verified Profile</span>
            </span>
          )}
        </div>

        {isRevealed && member.profile ? (
          <div className="space-y-3 pt-1">
            {member.profile.bio && (
              <div className="rounded-xl p-3.5 italic leading-relaxed border relative" style={{ background: "var(--color-surface2)", borderColor: "var(--color-border)" }}>
                <p className="text-[var(--color-fg)] not-italic">{member.profile.bio}</p>
              </div>
            )}

            {member.profile.social && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider opacity-40">
                  Connect & Links
                </span>
                <div className="flex gap-2 flex-wrap">
                  {member.profile.social.website && (
                    <a
                      href={member.profile.social.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all hover:scale-105 border text-amber-300"
                      style={{
                        background: "rgba(217, 119, 6, 0.12)",
                        borderColor: "rgba(217, 119, 6, 0.35)",
                      }}
                    >
                      <Globe size={12} />
                      <span>Website</span>
                    </a>
                  )}
                  {member.profile.social.instagram && (
                    <a
                      href={`https://instagram.com/${member.profile.social.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all hover:scale-105 border text-rose-300"
                      style={{
                        background: "rgba(244, 63, 94, 0.12)",
                        borderColor: "rgba(244, 63, 94, 0.35)",
                      }}
                    >
                      <Instagram size={12} />
                      <span>@{member.profile.social.instagram}</span>
                    </a>
                  )}
                  {member.profile.social.x && (
                    <a
                      href={`https://x.com/${member.profile.social.x}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all hover:scale-105 border text-sky-300"
                      style={{
                        background: "rgba(14, 165, 233, 0.12)",
                        borderColor: "rgba(14, 165, 233, 0.35)",
                      }}
                    >
                      <Twitter size={12} />
                      <span>@{member.profile.social.x}</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className="rounded-xl p-3.5 space-y-2 border text-center"
            style={{
              background: "var(--color-surface2)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="mx-auto h-9 w-9 rounded-full flex items-center justify-center bg-amber-500/10 text-amber-400">
              <Sparkles size={16} />
            </div>
            <p className="text-xs opacity-90 leading-relaxed font-medium">
              {isMe
                ? "You are currently anonymous in this room."
                : "This roommate is keeping their animal identity."}
            </p>
            <p className="text-[11px] opacity-60 leading-normal">
              {isMe
                ? "Other roommates only see your animal persona until you choose to reveal your profile."
                : "Their real name, bio, and social links will appear here if they choose to reveal."}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
