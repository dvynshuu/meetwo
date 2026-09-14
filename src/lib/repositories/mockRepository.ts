import { mockStore } from '../supabase/mockStore';
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
import {
  IMessageRepository,
  IServerRepository,
  IChannelRepository,
  IDMRepository,
  IBookmarkRepository,
  IThreadRepository,
  IForumRepository,
  INotificationRepository,
  IReadStateRepository,
  IStageRepository,
  ISearchRepository,
  IFriendRepository,
  ForumReplyItem,
  ThreadReplyItem,
  NotificationItem,
  GlobalSearchFilters,
  DetailedSearchResult,
  ResolvedInvite,
} from './types';

export class MockMessageRepository implements IMessageRepository {
  async getMessages(channelId: string): Promise<Message[]> {
    return mockStore.getMessages(channelId);
  }

  async sendMessage(
    channelId: string,
    author: User,
    content: string,
    replyToId?: string | null,
    attachments?: Attachment[]
  ): Promise<Message> {
    const msg = mockStore.sendMessage(channelId, content, author.id, undefined, attachments);
    msg.author = author;
    if (replyToId) msg.replyToId = replyToId;
    return msg;
  }

  async editMessage(messageId: string, _authorId: string, content: string): Promise<void> {
    mockStore.editMessage(messageId, content);
  }

  async deleteMessage(messageId: string): Promise<void> {
    mockStore.deleteMessage(messageId);
  }

  async toggleReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    mockStore.toggleReaction(messageId, userId, emoji);
  }
}

export class MockServerRepository implements IServerRepository {
  async getServers(): Promise<Server[]> {
    return mockStore.getServers();
  }

  async createServer(name: string, _ownerId: string, iconUrl?: string): Promise<Server> {
    return mockStore.createServer(name, iconUrl);
  }

  async getServerMembers(serverId: string): Promise<ServerMember[]> {
    return mockStore.getServerMembers(serverId);
  }

  async createInvite(
    serverId: string,
    creatorId: string,
    options?: { maxUses?: number; expiresInHours?: number }
  ): Promise<Invite> {
    return mockStore.createInvite(serverId, creatorId, options?.maxUses, options?.expiresInHours);
  }

  async resolveInvite(code: string): Promise<ResolvedInvite | null> {
    const invite = mockStore.getInviteByCode(code);
    if (!invite) return null;
    const server = mockStore.getServers().find((s) => s.id === invite.serverId);
    if (!server) return null;
    const members = mockStore.getServerMembers(server.id);
    return {
      invite,
      server,
      memberCount: members.length,
    };
  }

  async acceptInvite(code: string): Promise<{ server: Server; channelId?: string }> {
    const invite = mockStore.getInviteByCode(code);
    if (!invite) throw new Error('Invite not found');
    const server = mockStore.getServers().find((s) => s.id === invite.serverId);
    if (!server) throw new Error('Server not found');

    const curUser = mockStore.getCurrentUser();
    if (!curUser) throw new Error('Not authenticated');
    mockStore.addServerMember(server.id, curUser.id, 'member');
    mockStore.incrementInviteUses(invite.code);

    const firstChan = mockStore.getChannels().find((c) => c.serverId === server.id);
    return { server, channelId: firstChan?.id };
  }

  async getAuditLogs(serverId: string): Promise<AuditLogEntry[]> {
    return mockStore.getAuditLogs(serverId);
  }
}

export class MockChannelRepository implements IChannelRepository {
  async getChannels(serverId: string): Promise<Channel[]> {
    return mockStore.getChannels().filter((c) => c.serverId === serverId);
  }

  async getAllChannels(): Promise<Channel[]> {
    return mockStore.getChannels();
  }

  async createChannel(
    serverId: string,
    name: string,
    type: ChannelType,
    topic?: string,
    categoryId?: string
  ): Promise<Channel> {
    return mockStore.createChannel(serverId, name, type, topic, categoryId);
  }

  async getCategories(serverId: string): Promise<ChannelCategory[]> {
    return mockStore.getCategories().filter((c) => c.serverId === serverId);
  }

  async createCategory(serverId: string, name: string): Promise<ChannelCategory> {
    return mockStore.createCategory(serverId, name);
  }
}

export class MockDMRepository implements IDMRepository {
  private convos: DMConversation[] = [];
  private msgs: Record<string, DMMessage[]> = {};

  async getConversations(_userId: string): Promise<DMConversation[]> {
    return this.convos;
  }

  async getMessages(conversationId: string): Promise<DMMessage[]> {
    return this.msgs[conversationId] || [];
  }

  async sendMessage(conversationId: string, author: User, content: string): Promise<DMMessage> {
    const msg: DMMessage = {
      id: `mock-dm-${Date.now()}`,
      conversationId,
      authorId: author.id,
      content,
      createdAt: new Date().toISOString(),
      author,
    };
    if (!this.msgs[conversationId]) this.msgs[conversationId] = [];
    this.msgs[conversationId].push(msg);
    return msg;
  }

  async startConversation(_currentUser: User, targetUser: User): Promise<string> {
    const id = `mock-convo-${Date.now()}`;
    this.convos.push({
      id,
      participants: [targetUser],
      unreadCount: 0,
      createdAt: new Date().toISOString(),
    });
    return id;
  }
}

export class MockBookmarkRepository implements IBookmarkRepository {
  async getBookmarks(): Promise<Bookmark[]> {
    return mockStore.getBookmarks();
  }

  async toggleBookmark(_userId: string, message: Message, channelName: string = 'chat'): Promise<boolean> {
    return mockStore.toggleBookmark(message, channelName);
  }

  async isBookmarked(_userId: string, messageId: string): Promise<boolean> {
    return mockStore.getBookmarks().some((b) => b.messageId === messageId);
  }
}

export class MockThreadRepository implements IThreadRepository {
  private cache = new Map<string, ThreadReplyItem[]>();

  async getReplies(parentMessageId: string): Promise<ThreadReplyItem[]> {
    return this.cache.get(parentMessageId) || [];
  }

  async sendReply(parentMessageId: string, _channelId: string, author: User, content: string): Promise<ThreadReplyItem> {
    const reply: ThreadReplyItem = {
      id: `mock-rep-${Date.now()}`,
      authorId: author.id,
      authorName: author.displayName || author.username,
      avatarUrl: author.avatarUrl,
      content,
      createdAt: new Date().toISOString(),
    };
    const list = this.cache.get(parentMessageId) || [];
    list.push(reply);
    this.cache.set(parentMessageId, list);
    return reply;
  }
}

export class MockForumRepository implements IForumRepository {
  async getPosts(channelId: string): Promise<ForumPost[]> {
    return mockStore.getForumPosts(channelId);
  }

  async createPost(channelId: string, author: User, title: string, content: string, tags?: string[]): Promise<ForumPost> {
    const post = mockStore.createForumPost(channelId, author.id, title, content, tags || []);
    return { ...post, author };
  }

  async getReplies(): Promise<ForumReplyItem[]> {
    return [];
  }

  async addReply(_postId: string, author: User, content: string): Promise<ForumReplyItem> {
    return {
      id: `mock-f-rep-${Date.now()}`,
      authorId: author.id,
      authorName: author.displayName || author.username,
      avatarUrl: author.avatarUrl || '',
      content,
      createdAt: 'Just now',
      likes: 0,
    };
  }

  async markSolved(): Promise<void> {}
}

export class MockNotificationRepository implements INotificationRepository {
  private notifications: NotificationItem[] = [];

  async getNotifications(): Promise<NotificationItem[]> {
    return this.notifications;
  }

  async markAsRead(id: string): Promise<void> {
    this.notifications = this.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
  }

  async markAllAsRead(): Promise<void> {
    this.notifications = this.notifications.map((n) => ({ ...n, isRead: true }));
  }
}

export class MockReadStateRepository implements IReadStateRepository {
  private reads: Record<string, string> = {};

  async getReadStates(): Promise<Record<string, string>> {
    return this.reads;
  }

  async markAsRead(_userId: string, target: { channelId?: string; conversationId?: string }): Promise<void> {
    const key = target.channelId || target.conversationId;
    if (key) this.reads[key] = new Date().toISOString();
  }
}

export class MockStageRepository implements IStageRepository {
  async getStageState(channelId: string): Promise<StageChannelState | null> {
    return mockStore.getStageState(channelId);
  }

  async raiseHand(channelId: string): Promise<void> {
    const u = mockStore.getCurrentUser();
    if (!u) return;
    mockStore.requestToSpeak(channelId, u.id);
  }

  async lowerHand(channelId: string, targetUserId?: string): Promise<void> {
    const u = mockStore.getCurrentUser();
    if (!u) return;
    mockStore.lowerHand(channelId, u.id, targetUserId || u.id);
  }

  async moderateSpeaker(channelId: string, targetUserId: string, action: 'invite' | 'demote'): Promise<void> {
    const u = mockStore.getCurrentUser();
    if (!u) return;
    if (action === 'invite') {
      mockStore.approveSpeaker(channelId, u.id, targetUserId);
    } else {
      mockStore.demoteSpeaker(channelId, u.id, targetUserId);
    }
  }
}

export class MockSearchRepository implements ISearchRepository {
  async search(filters: GlobalSearchFilters): Promise<DetailedSearchResult[]> {
    const clean = filters.query.toLowerCase();
    const channels = mockStore.getChannels();
    const results: DetailedSearchResult[] = [];

    for (const ch of channels) {
      for (const m of mockStore.getMessages(ch.id)) {
        if (m.content.toLowerCase().includes(clean)) {
          results.push({
            id: m.id,
            type: 'message',
            title: m.author?.displayName || 'User',
            subtitle: m.content,
            channelId: ch.id,
            serverId: ch.serverId,
            messageContent: m.content,
          });
        }
      }
    }
    return results;
  }
}

export class MockFriendRepository implements IFriendRepository {
  async getFriends(): Promise<Friend[]> {
    return [];
  }

  async addFriend(): Promise<{ success: boolean; user?: User; error?: string }> {
    return { success: false, error: 'Offline mode' };
  }

  async acceptFriendRequest(): Promise<void> {}

  async removeFriend(): Promise<void> {}

  async searchUsers(): Promise<User[]> {
    return mockStore.getAllUsers();
  }
}
