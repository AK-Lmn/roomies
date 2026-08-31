export const LIMITS = {
  usernameMin: 3,
  usernameMax: 20,
  displayNameMin: 2,
  displayNameMax: 32,
  bioMax: 160,
  messageMax: 1000,
  wallPostMax: 2000,
  fridgeNoteMax: 180,
  songTitleMax: 80,
  songArtistMax: 80,
  songUrlMax: 400,
  dailyAnswerMax: 500,
  reportReasonMax: 400,
  socialUrlMax: 200,
  imageDataMax: 180_000,
  roomMin: 2,
  roomTarget: 4,
  roomMax: 8,
  matchWaitMs: 8_000,
  fillWindowMs: 24 * 60 * 60 * 1000,
  roomDurationMs: 7 * 24 * 60 * 60 * 1000,
  presenceOnlineMs: 45_000,
  closingSoonMs: 24 * 60 * 60 * 1000,
} as const;

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}
