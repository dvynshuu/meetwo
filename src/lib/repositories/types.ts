import {
  User,
  Server,
  Channel,
  ChannelCategory,
  ServerMember,
  ChannelType,
  Message,
  Attachment,
  Bookmark,
  ForumPost,
  DMConversation,
  DMMessage,
  Friend,
  Invite,
  StageChannelState,
  AuditLogEntry,
} from '../../types';

export class ServiceError extends Error {
  public code: string;
  public details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.details = details;
  }
}

export interface ForumReplyItem {
  id: string;
  authorId: string;
  authorName: string;
  avatarUrl: string;
  content: string;
  createdAt: string;
  likes: number;
}

export interface ThreadReplyItem {
  id: string;
  authorId: string;
  authorName: string;
  avatarUrl?: string;
  content: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: 'mention' | 'reply' | 'dm' | 'invite' | 'system';
  sourceId?: string;
  actorId?: string;
  serverId?: string;
  channelId?: string;
  conversationId?: string;
  content: string;
  metadata?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

export interface GlobalSearchFilters {
  query: string;
  fromUser?: string;
  inChannel?: string;
}

export interface DetailedSearchResult {
  id: string;
  type: 'message' | 'channel' | 'server' | 'user';
  title: string;
  subtitle: string;
  channelId?: string;
  serverId?: string;
  messageContent?: string;
  authorName?: string;
  authorAvatar?: string;
  timestamp?: string;
}

export interface ResolvedInvite {
  invite: Invite;
  server: Server;
  inviter?: { displayName: string; avatarUrl?: string };
  isMember?: boolean;
  memberCount?: number;
}

export interface IMessageRepository {
  getMessages(channelId: string): Promise<Message[]>;
  sendMessage(
    channelId: string,
    author: User,
    content: string,
    replyToId?: string | null,
    attachments?: Attachment[]
  ): Promise<Message>;
  editMessage(messageId: string, authorId: string, content: string): Promise<void>;
  deleteMessage(messageId: string): Promise<void>;
  toggleReaction(messageId: string, userId: string, emoji: string): Promise<void>;
}

export interface IServerRepository {
  getServers(): Promise<Server[]>;
  createServer(name: string, ownerId: string, iconUrl?: string): Promise<Server>;
  getServerMembers(serverId: string): Promise<ServerMember[]>;
  createInvite(serverId: string, creatorId: string, options?: { maxUses?: number; expiresInHours?: number }): Promise<Invite>;
  resolveInvite(code: string): Promise<ResolvedInvite | null>;
  acceptInvite(code: string): Promise<{ server: Server; channelId?: string }>;
  getAuditLogs(serverId: string): Promise<AuditLogEntry[]>;
}

export interface IChannelRepository {
  getChannels(serverId: string): Promise<Channel[]>;
  getAllChannels(): Promise<Channel[]>;
  createChannel(
    serverId: string,
    name: string,
    type: ChannelType,
    topic?: string,
    categoryId?: string
  ): Promise<Channel>;
  getCategories(serverId: string): Promise<ChannelCategory[]>;
  createCategory(serverId: string, name: string): Promise<ChannelCategory>;
}

export interface IDMRepository {
  getConversations(userId: string): Promise<DMConversation[]>;
  getMessages(conversationId: string): Promise<DMMessage[]>;
  sendMessage(conversationId: string, author: User, content: string): Promise<DMMessage>;
  startConversation(currentUser: User, targetUser: User): Promise<string>;
}

export interface IBookmarkRepository {
  getBookmarks(userId: string): Promise<Bookmark[]>;
  toggleBookmark(userId: string, message: Message, channelName?: string): Promise<boolean>;
  isBookmarked(userId: string, messageId: string): Promise<boolean>;
}

export interface IThreadRepository {
  getReplies(parentMessageId: string, channelId: string): Promise<ThreadReplyItem[]>;
  sendReply(parentMessageId: string, channelId: string, author: User, content: string): Promise<ThreadReplyItem>;
}

export interface IForumRepository {
  getPosts(channelId: string): Promise<ForumPost[]>;
  createPost(channelId: string, author: User, title: string, content: string, tags?: string[]): Promise<ForumPost>;
  getReplies(postId: string): Promise<ForumReplyItem[]>;
  addReply(postId: string, author: User, content: string): Promise<ForumReplyItem>;
  markSolved(postId: string, isSolved: boolean): Promise<void>;
}

export interface INotificationRepository {
  getNotifications(userId: string): Promise<NotificationItem[]>;
  markAsRead(notificationId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
}

export interface IReadStateRepository {
  getReadStates(userId: string): Promise<Record<string, string>>;
  markAsRead(userId: string, target: { channelId?: string; conversationId?: string; messageId?: string }): Promise<void>;
}

export interface IStageRepository {
  getStageState(channelId: string): Promise<StageChannelState | null>;
  raiseHand(channelId: string): Promise<void>;
  lowerHand(channelId: string, targetUserId?: string): Promise<void>;
  moderateSpeaker(channelId: string, targetUserId: string, action: 'invite' | 'demote'): Promise<void>;
}

export interface ISearchRepository {
  search(filters: GlobalSearchFilters, accessibleChannelIds?: string[]): Promise<DetailedSearchResult[]>;
}

export interface IFriendRepository {
  getFriends(userId: string): Promise<Friend[]>;
  addFriend(currentUserId: string, targetUsername: string): Promise<{ success: boolean; user?: User; error?: string }>;
  acceptFriendRequest(userId: string, friendId: string): Promise<void>;
  removeFriend(userId: string, friendId: string): Promise<void>;
  searchUsers(query: string, currentUserId: string): Promise<User[]>;
}
