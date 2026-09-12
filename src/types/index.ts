export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface CustomStatus {
  text: string;
  emoji?: string;
  expiresAt?: string;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  status: UserStatus;
  customStatus?: CustomStatus;
  createdAt: string;
  updatedAt?: string;
}

export type ChannelType = 'text' | 'voice' | 'stage' | 'announcement' | 'forum';

export interface ChannelCategory {
  id: string;
  serverId: string;
  name: string;
  position: number;
}

export interface Channel {
  id: string;
  serverId: string;
  name: string;
  type: ChannelType;
  topic?: string;
  categoryId?: string;
  position: number;
  isLocked?: boolean;
  createdAt: string;
}

export type MemberRole = 'owner' | 'admin' | 'moderator' | 'member';

export interface ServerMember {
  serverId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
  user?: User;
}

export interface Server {
  id: string;
  name: string;
  iconUrl?: string;
  description?: string;
  ownerId: string;
  createdAt: string;
  categories?: ChannelCategory[];
  channels?: Channel[];
  members?: ServerMember[];
}

export interface MessageReaction {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface Attachment {
  id: string;
  messageId?: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  contentType: string;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  author?: User;
  isOptimistic?: boolean;
  isEdited?: boolean;
  isPinned?: boolean;
  isBookmarked?: boolean;
  replyToId?: string | null;
  replyTo?: {
    id: string;
    authorName: string;
    content: string;
  } | null;
  reactions?: MessageReaction[];
  attachments?: Attachment[];
}

export interface ForumPost {
  id: string;
  channelId: string;
  authorId: string;
  title: string;
  content: string;
  tags: string[];
  repliesCount: number;
  isSolved: boolean;
  createdAt: string;
  author?: User;
}

export interface StageParticipant {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isSpeaker: boolean;
  isHandRaised: boolean;
  isMuted: boolean;
  stream?: MediaStream;
}

export interface AuditLogEntry {
  id: string;
  serverId: string;
  actorName: string;
  action: string;
  target: string;
  timestamp: string;
}

export interface Bookmark {
  id: string;
  userId: string;
  messageId: string;
  message: Message;
  channelName: string;
  createdAt: string;
}

export interface Invite {
  id: string;
  serverId: string;
  code: string;
  creatorId: string;
  expiresAt?: string;
  usesCount: number;
  createdAt?: string;
}

export interface TypingUser {
  userId: string;
  username: string;
  channelId: string;
  timestamp: number;
}

export type VideoQuality = '1080p' | '720p' | '480p';

export interface MediaDeviceSettings {
  audioInputId: string;
  audioOutputId: string;
  videoInputId: string;
  videoQuality: VideoQuality;
  echoCancellation: boolean;
  noiseSuppression: boolean;
}

export type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'reconnecting';

export interface Participant {
  id: string; // Peer or Session ID
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  stream?: MediaStream;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  isStageSpeaker?: boolean;
  audioLevel?: number; // 0 to 100
  connectionQuality?: ConnectionQuality;
  isPinned?: boolean;
}

export interface PeerSignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join-room' | 'leave-room' | 'mute-state' | 'hand-raise';
  fromPeerId: string;
  toPeerId?: string;
  roomId: string;
  payload: any;
  polite?: boolean;
}

export interface CommandItem {
  id: string;
  title: string;
  category: 'Channels' | 'Servers' | 'Actions' | 'Settings' | 'Stages';
  icon: string;
  action: () => void;
  shortcut?: string;
}

export interface SearchResult {
  id: string;
  type: 'message' | 'channel' | 'server' | 'user';
  title: string;
  subtitle: string;
  channelId?: string;
  serverId?: string;
}

export interface TelemetryEvent {
  id: string;
  type: 'AUTH' | 'REALTIME' | 'MEDIA' | 'UPLOAD' | 'SEARCH';
  status: 'ok' | 'warning' | 'error';
  latencyMs?: number;
  message: string;
  timestamp: string;
}
