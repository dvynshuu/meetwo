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

export type VideoQuality = '1080p' | '720p' | '480p' | '360p';
export type QualityMode = 'auto' | 'high' | 'balanced' | 'low_bandwidth';

export type MediaLifecycleState =
  | 'idle'
  | 'initializing'
  | 'measuring'
  | 'connecting'
  | 'connected'
  | 'degraded'
  | 'reconnecting'
  | 'recovering'
  | 'failed';

export type ConnectionQuality =
  | 'unknown'
  | 'excellent'
  | 'good'
  | 'fair'
  | 'poor'
  | 'reconnecting';

export interface ConnectionStats {
  rtt?: number; // ms (undefined when unavailable)
  packetLoss?: number; // % (undefined when unavailable)
  jitter?: number; // ms (undefined when unavailable)
  bitrate?: number; // kbps (undefined when unavailable)
  fps?: number; // frames per second (undefined when unavailable)
  frameDropRate?: number; // %
  resolution?: string;
  audioCodec?: string; // Strictly measured or undefined
  videoCodec?: string; // Strictly measured or undefined
  candidateType?: string;
  transportType?: 'livekit' | 'p2p';
  packetsReceived?: number;
  packetsLost?: number;
  packetsSent?: number;
  bytesReceived?: number;
  bytesSent?: number;
  quality: ConnectionQuality;
}

export interface MediaDeviceSettings {
  audioInputId: string;
  audioOutputId: string;
  videoInputId: string;
  videoQuality: VideoQuality;
  qualityMode: QualityMode;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  inputVolume: number; // 0 to 100
  outputVolume: number; // 0 to 100
}

export type MediaError =
  | 'microphone-denied'
  | 'camera-denied'
  | 'device-disconnected'
  | 'device-not-found'
  | 'network-failure'
  | 'transport-failure'
  | 'permission-failure'
  | 'screen-share-failure';

export interface MediaAppError {
  code: MediaError;
  userMessage: string;
  recoveryAction: string;
  technicalDetails?: string;
  timestamp: string;
}

export type StageRole = 'host' | 'speaker' | 'listener';

export interface StageChannelState {
  channelId: string;
  hostId: string;
  speakers: string[];
  handRaisedQueue: string[];
  stageSettings?: {
    isOpen: boolean;
  };
}

export interface Participant {
  id: string; // Peer or Session ID
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  stream?: MediaStream; // Camera / primary stream
  screenStream?: MediaStream; // Dedicated screen share stream
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  stageRole?: 'host' | 'speaker' | 'listener';
  isStageSpeaker?: boolean;
  isHandRaised?: boolean;
  audioLevel?: number; // 0 to 100
  connectionQuality?: ConnectionQuality;
  stats?: ConnectionStats;
  isPinned?: boolean;
}

export interface PeerSignalMessage {
  type:
    | 'offer'
    | 'answer'
    | 'ice-candidate'
    | 'join-room'
    | 'leave-room'
    | 'mute-state'
    | 'speaking-state'
    | 'hand-raise'
    | 'stage-role'
    | 'stage-invite'
    | 'stage-demote'
    | 'stage-hand-dismiss'
    | 'track-update';
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
