export type RoomStatus = "waiting" | "active" | "archived";

export type SocialLinks = {
  facebook: string;
  instagram: string;
  x: string;
  website?: string;
};

export type Profile = {
  userId: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  social: SocialLinks;
  showBio: boolean;
  showSocial: boolean;
  showJoined: boolean;
  createdAt: string;
};

export type Roommate = {
  userId: string;
  tempIdentity: string;
  identityAnimal: string;
  identityColor: string;
  revealed: boolean;
  online: boolean;
  lastSeenAt: string;
  joinedAt: string;
  isMe: boolean;
  profile: {
    username: string;
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
    social: SocialLinks | null;
    createdAt: string | null;
  } | null;
};

export type RoomSummary = {
  id: string;
  name: string;
  status: RoomStatus;
  createdAt: string;
  startedAt: string | null;
  endsAt: string | null;
  memberCount: number;
  remainingMs: number;
  isMember: boolean;
};

export type RoomView = RoomSummary & {
  members: Roommate[];
  closingSoon: boolean;
  filling: boolean;
  myIdentity: string;
  myRevealed: boolean;
};

export type MessageReaction = {
  emoji: string;
  count: number;
  mine: boolean;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  userId: string;
  body: string;
  createdAt: string;
  identity: string;
  animal: string;
  color: string;
  revealedName: string | null;
  isMe: boolean;
  reactions: MessageReaction[];
  replyTo?: {
    id: string;
    body: string;
    identity: string;
  } | null;
};

export type WallPost = {
  id: string;
  roomId: string;
  userId: string;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  identity: string;
  animal: string;
  color: string;
  revealedName: string | null;
  isMe: boolean;
  reactions: Array<{ kind: string; count: number; mine: boolean }>;
};

export type FridgeNote = {
  id: string;
  roomId: string;
  userId: string;
  body: string;
  color: string;
  tilt: number;
  createdAt: string;
  identity: string;
  isMe: boolean;
};

export type Song = {
  id: string;
  roomId: string;
  userId: string;
  title: string;
  artist: string;
  url: string;
  coverUrl: string | null;
  createdAt: string;
  identity: string;
  isMe: boolean;
};

export type DailyQuestionView = {
  dayIndex: number;
  dayLabel: string;
  questionId: number;
  prompt: string;
  myAnswer: string | null;
  answers: Array<{
    userId: string;
    identity: string;
    animal: string;
    color: string;
    body: string;
    createdAt: string;
    isMe: boolean;
  }>;
};

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  roomId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type RoomMemory = {
  room: RoomSummary;
  members: Array<{ identity: string; animal: string; color: string; revealedName: string | null }>;
  messageCount: number;
  wallCount: number;
  songCount: number;
  answerCount: number;
  noteCount: number;
  finalMessages: ChatMessage[];
  saved: boolean;
};

export type MatchResult =
  | { status: "matched"; roomId: string; name: string }
  | { status: "matching"; waitedMs: number }
  | { status: "needs_profile" };
