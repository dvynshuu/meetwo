import {
  User,
  Server,
  Channel,
  ChannelCategory,
  Message,
  ServerMember,
  Invite,
  Attachment,
  MessageReaction,
  ForumPost,
  Bookmark,
  AuditLogEntry,
  TelemetryEvent,
  CustomStatus,
  ChannelType,
  StageChannelState,
  StageRole,
} from '../../types';

const STORAGE_KEYS = {
  CURRENT_USER: 'meetwo_current_user',
  SERVERS: 'meetwo_servers',
  CATEGORIES: 'meetwo_categories',
  CHANNELS: 'meetwo_channels',
  MEMBERS: 'meetwo_members',
  MESSAGES: 'meetwo_messages',
  FORUM_POSTS: 'meetwo_forum_posts',
  BOOKMARKS: 'meetwo_bookmarks',
  AUDIT_LOGS: 'meetwo_audit_logs',
  INVITES: 'meetwo_invites',
  TELEMETRY: 'meetwo_telemetry',
  STAGE_STATES: 'meetwo_stage_states',
  REGISTERED_USERS: 'meetwo_registered_users',
};

// Automatic one-time purge of legacy mock data from localStorage
const MOCK_DATA_PURGED_FLAG = 'meetwo_mock_data_purged_v3';
if (typeof window !== 'undefined') {
  try {
    if (!localStorage.getItem(MOCK_DATA_PURGED_FLAG)) {
      const keysToPurge = [
        'meetwo_servers',
        'meetwo_categories',
        'meetwo_channels',
        'meetwo_members',
        'meetwo_messages',
        'meetwo_forum_posts',
        'meetwo_bookmarks',
        'meetwo_audit_logs',
        'meetwo_current_user',
        'meetwo_stage_states',
        'meetwo_registered_users',
        'mw:dm:conversations',
        'mw:dm:messages',
        'mw:dm:friends',
        'mw:inbox:items',
        'mw:inbox:read_channels',
        'mw:nav:recent',
      ];
      keysToPurge.forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(MOCK_DATA_PURGED_FLAG, 'true');
    }
  } catch {}
}

// Clean Empty Seed Datasets (All mock data and mock users removed)
export const SEED_USERS: User[] = [];
export const SEED_SERVERS: Server[] = [];
export const SEED_CATEGORIES: ChannelCategory[] = [];
export const SEED_CHANNELS: Channel[] = [];
export const SEED_MEMBERS: ServerMember[] = [];
export const SEED_MESSAGES: Message[] = [];
export const SEED_FORUM_POSTS: ForumPost[] = [];
export const SEED_AUDIT_LOGS: AuditLogEntry[] = [];

class MockStore {
  private broadcastChannel: BroadcastChannel | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('meetwo_realtime_bus');
        this.broadcastChannel.onmessage = (event) => {
          const { type, payload } = event.data;
          this.notifyLocal(type, payload);
        };
      } catch (err) {
        console.warn('BroadcastChannel not supported:', err);
      }
    }
  }

  public emit(type: string, payload: any) {
    this.notifyLocal(type, payload);
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type, payload });
    }
  }

  public subscribe(type: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);

    return () => {
      this.listeners.get(type)?.delete(callback);
    };
  }

  public on(type: string, callback: (data: any) => void): () => void {
    return this.subscribe(type, callback);
  }

  private notifyLocal(type: string, payload: any) {
    const callbacks = this.listeners.get(type);
    if (callbacks) {
      callbacks.forEach((cb) => cb(payload));
    }
  }

  // Current User & Custom Status
  public getCurrentUser(): User | null {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return null;
  }

  public setCurrentUser(user: User | null) {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      this.addUser(user);
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
    this.emit('USER_UPDATED', user);
  }

  public updateCustomStatus(status: CustomStatus | undefined) {
    const user = this.getCurrentUser();
    if (user) {
      user.customStatus = status;
      this.setCurrentUser(user);
    }
  }

  // User Directory
  public getAllUsers(): User[] {
    const saved = localStorage.getItem(STORAGE_KEYS.REGISTERED_USERS);
    let list: User[] = [];
    if (saved) {
      try {
        list = JSON.parse(saved);
      } catch {}
    }
    const current = this.getCurrentUser();
    if (current && !list.some((u) => u.id === current.id)) {
      list.push(current);
    }
    return list;
  }

  public addUser(user: User) {
    const list = this.getAllUsers();
    if (!list.some((u) => u.id === user.id)) {
      list.push(user);
      localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(list));
      this.emit('USER_REGISTERED', user);
    }
  }

  // Servers
  public getServers(): Server[] {
    const saved = localStorage.getItem(STORAGE_KEYS.SERVERS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  }

  public createServer(name: string, iconUrl?: string): Server {
    const servers = this.getServers();
    const currentUser = this.getCurrentUser();
    const ownerId = currentUser ? currentUser.id : `user-${Date.now()}`;
    const newServer: Server = {
      id: `server-${Date.now()}`,
      name,
      iconUrl: iconUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${name}`,
      description: `${name} community`,
      ownerId,
      createdAt: new Date().toISOString(),
    };
    servers.push(newServer);
    localStorage.setItem(STORAGE_KEYS.SERVERS, JSON.stringify(servers));

    // Create default categories & channels
    const cat = { id: `cat-${Date.now()}`, serverId: newServer.id, name: 'Text Channels', position: 0 };
    const categories = this.getCategories();
    categories.push(cat);
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));

    const defaultTextChannel: Channel = {
      id: `chan-${Date.now()}-1`,
      serverId: newServer.id,
      categoryId: cat.id,
      name: 'general',
      type: 'text',
      topic: `Welcome to ${name}!`,
      position: 0,
      createdAt: new Date().toISOString(),
    };
    const defaultVoiceChannel: Channel = {
      id: `chan-${Date.now()}-2`,
      serverId: newServer.id,
      categoryId: cat.id,
      name: 'General Voice',
      type: 'voice',
      topic: 'Voice and video discussion',
      position: 1,
      createdAt: new Date().toISOString(),
    };
    const channels = this.getChannels();
    channels.push(defaultTextChannel, defaultVoiceChannel);
    localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(channels));

    const members = this.getMembers();
    members.push({
      serverId: newServer.id,
      userId: ownerId,
      role: 'owner',
      joinedAt: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));

    this.emit('SERVER_CREATED', newServer);
    return newServer;
  }

  // Categories
  public getCategories(): ChannelCategory[] {
    const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  }

  public createCategory(serverId: string, name: string): ChannelCategory {
    const categories = this.getCategories();
    const serverCategories = categories.filter((c) => c.serverId === serverId);
    const newCategory: ChannelCategory = {
      id: `cat-${Date.now()}`,
      serverId,
      name,
      position: serverCategories.length,
    };
    categories.push(newCategory);
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    return newCategory;
  }

  // Channels
  public getChannels(): Channel[] {
    const saved = localStorage.getItem(STORAGE_KEYS.CHANNELS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  }

  public createChannel(
    serverId: string,
    name: string,
    type: ChannelType,
    topic?: string,
    categoryId?: string
  ): Channel {
    const channels = this.getChannels();
    const existingInServer = channels.filter((c) => c.serverId === serverId);
    const newChannel: Channel = {
      id: `chan-${Date.now()}`,
      serverId,
      categoryId: categoryId || undefined,
      name: name.toLowerCase().replace(/\s+/g, '-'),
      type,
      topic: topic || '',
      position: existingInServer.length,
      createdAt: new Date().toISOString(),
    };
    channels.push(newChannel);
    localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(channels));
    this.emit('CHANNEL_CREATED', newChannel);
    return newChannel;
  }

  // Members
  public getMembers(): ServerMember[] {
    const saved = localStorage.getItem(STORAGE_KEYS.MEMBERS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  }

  public getServerMembers(serverId: string): ServerMember[] {
    const members = this.getMembers();
    const users = this.getAllUsers();
    return members
      .filter((m) => m.serverId === serverId)
      .map((m) => ({
        ...m,
        user: users.find((u) => u.id === m.userId),
      }));
  }

  public isServerMember(serverId: string, userId: string): boolean {
    const members = this.getMembers();
    return members.some((m) => m.serverId === serverId && m.userId === userId);
  }

  public addServerMember(
    serverId: string,
    userId: string,
    role: 'owner' | 'admin' | 'member' = 'member'
  ): ServerMember {
    const members = this.getMembers();
    let member = members.find((m) => m.serverId === serverId && m.userId === userId);
    if (!member) {
      member = {
        serverId,
        userId,
        role,
        joinedAt: new Date().toISOString(),
      };
      members.push(member);
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
      this.emit('MEMBER_JOINED', member);
    }
    return member;
  }

  public addServer(server: Server): void {
    const servers = this.getServers();
    if (!servers.some((s) => s.id === server.id)) {
      servers.push(server);
      localStorage.setItem(STORAGE_KEYS.SERVERS, JSON.stringify(servers));
      this.emit('SERVER_CREATED', server);
    }
  }

  // Invites
  public getInvites(serverId?: string): Invite[] {
    const saved = localStorage.getItem(STORAGE_KEYS.INVITES);
    let allInvites: Invite[] = [];
    if (saved) {
      try {
        allInvites = JSON.parse(saved);
      } catch {}
    }
    if (serverId) {
      return allInvites.filter((inv) => inv.serverId === serverId);
    }
    return allInvites;
  }

  public getInviteByCode(code: string): Invite | null {
    if (!code) return null;
    const cleanCode = code.trim().toUpperCase();
    const invites = this.getInvites();
    return invites.find((inv) => inv.code.toUpperCase() === cleanCode) || null;
  }

  public createInvite(
    serverId: string,
    creatorId: string,
    maxUses?: number,
    expiresInHours?: number
  ): Invite {
    const invites = this.getInvites();
    // Re-use an existing non-expiring unlimited invite if available
    if (!maxUses && !expiresInHours) {
      const existing = invites.find(
        (inv) => inv.serverId === serverId && !inv.expiresAt && !inv.maxUses
      );
      if (existing) return existing;
    }

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = expiresInHours
      ? new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString()
      : undefined;

    const newInvite: Invite = {
      id: `inv-${Date.now()}`,
      serverId,
      code,
      creatorId,
      maxUses: maxUses || undefined,
      expiresAt,
      usesCount: 0,
      createdAt: new Date().toISOString(),
    };

    invites.push(newInvite);
    localStorage.setItem(STORAGE_KEYS.INVITES, JSON.stringify(invites));
    this.emit('INVITE_CREATED', newInvite);
    return newInvite;
  }

  public incrementInviteUses(code: string): void {
    const invites = this.getInvites();
    const cleanCode = code.trim().toUpperCase();
    const idx = invites.findIndex((inv) => inv.code.toUpperCase() === cleanCode);
    if (idx !== -1) {
      invites[idx].usesCount = (invites[idx].usesCount || 0) + 1;
      localStorage.setItem(STORAGE_KEYS.INVITES, JSON.stringify(invites));
      this.emit('INVITE_UPDATED', invites[idx]);
    }
  }

  // Messages
  public getMessages(channelId: string): Message[] {
    const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    let allMessages: Message[] = [];
    if (saved) {
      try {
        allMessages = JSON.parse(saved);
      } catch {}
    }

    const users = this.getAllUsers();
    const bookmarks = this.getBookmarks();
    const currentUserId = this.getCurrentUser()?.id || '';

    return allMessages
      .filter((m) => m.channelId === channelId)
      .map((m) => ({
        ...m,
        isBookmarked: bookmarks.some((b) => b.messageId === m.id && b.userId === currentUserId),
        author: users.find((u) => u.id === m.authorId) || {
          id: m.authorId,
          username: 'user',
          displayName: 'User',
          status: 'online',
          createdAt: new Date().toISOString(),
        },
      }));
  }

  public sendMessage(
    channelId: string,
    content: string,
    authorId: string,
    replyTo?: Message | null,
    attachments?: Attachment[]
  ): Message {
    const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    const allMessages: Message[] = saved ? JSON.parse(saved) : [];
    const users = this.getAllUsers();
    const author = users.find((u) => u.id === authorId) || this.getCurrentUser() || {
      id: authorId,
      username: 'user',
      displayName: 'User',
      status: 'online',
      createdAt: new Date().toISOString(),
    };

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      channelId,
      authorId,
      content,
      createdAt: new Date().toISOString(),
      replyToId: replyTo?.id || null,
      replyTo: replyTo
        ? {
            id: replyTo.id,
            authorName: replyTo.author?.displayName || replyTo.author?.username || 'User',
            content: replyTo.content,
          }
        : null,
      reactions: [],
      attachments: attachments || [],
      author,
    };

    allMessages.push(newMessage);
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(allMessages));
    this.emit('NEW_MESSAGE', newMessage);
    return newMessage;
  }

  public editMessage(messageId: string, content: string): Message | null {
    const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    if (!saved) return null;
    const allMessages: Message[] = JSON.parse(saved);
    const index = allMessages.findIndex((m) => m.id === messageId);
    if (index === -1) return null;

    allMessages[index] = {
      ...allMessages[index],
      content,
      isEdited: true,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(allMessages));
    this.emit('MESSAGE_EDITED', allMessages[index]);
    return allMessages[index];
  }

  public deleteMessage(messageId: string): boolean {
    const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    if (!saved) return false;
    const allMessages: Message[] = JSON.parse(saved);
    const filtered = allMessages.filter((m) => m.id !== messageId);
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(filtered));
    this.emit('MESSAGE_DELETED', messageId);
    return true;
  }

  public toggleReaction(messageId: string, emoji: string, userId: string): Message | null {
    const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    if (!saved) return null;
    const allMessages: Message[] = JSON.parse(saved);
    const msg = allMessages.find((m) => m.id === messageId);
    if (!msg) return null;

    if (!msg.reactions) msg.reactions = [];
    const reaction = msg.reactions.find((r) => r.emoji === emoji);

    if (reaction) {
      if (reaction.userIds.includes(userId)) {
        reaction.userIds = reaction.userIds.filter((id) => id !== userId);
        reaction.count -= 1;
        if (reaction.count <= 0) {
          msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji);
        }
      } else {
        reaction.userIds.push(userId);
        reaction.count += 1;
      }
    } else {
      msg.reactions.push({
        emoji,
        count: 1,
        userIds: [userId],
      });
    }

    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(allMessages));
    this.emit('REACTION_TOGGLED', { messageId, emoji, userId });
    return msg;
  }

  // Bookmarks
  public getBookmarks(): Bookmark[] {
    const saved = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  }

  public toggleBookmark(message: Message, channelName: string): boolean {
    const currentUserId = this.getCurrentUser()?.id || 'guest';
    const bookmarks = this.getBookmarks();
    const existingIndex = bookmarks.findIndex(
      (b) => b.messageId === message.id && b.userId === currentUserId
    );

    if (existingIndex >= 0) {
      bookmarks.splice(existingIndex, 1);
      localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
      this.emit('BOOKMARK_REMOVED', message.id);
      return false;
    } else {
      const newBookmark: Bookmark = {
        id: `bm-${Date.now()}`,
        userId: currentUserId,
        messageId: message.id,
        message,
        channelName,
        createdAt: new Date().toISOString(),
      };
      bookmarks.unshift(newBookmark);
      localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
      this.emit('BOOKMARK_ADDED', newBookmark);
      return true;
    }
  }

  // Forum Posts
  public getForumPosts(channelId: string): ForumPost[] {
    const saved = localStorage.getItem(STORAGE_KEYS.FORUM_POSTS);
    let allPosts: ForumPost[] = [];
    if (saved) {
      try {
        allPosts = JSON.parse(saved);
      } catch {}
    }
    return allPosts.filter((p) => p.channelId === channelId);
  }

  public createForumPost(
    channelId: string,
    authorId: string,
    title: string,
    content: string,
    tags: string[]
  ): ForumPost {
    const saved = localStorage.getItem(STORAGE_KEYS.FORUM_POSTS);
    const allPosts: ForumPost[] = saved ? JSON.parse(saved) : [];
    const users = this.getAllUsers();
    const author = users.find((u) => u.id === authorId) || this.getCurrentUser() || undefined;

    const newPost: ForumPost = {
      id: `post-${Date.now()}`,
      channelId,
      authorId,
      title,
      content,
      tags,
      repliesCount: 0,
      isSolved: false,
      createdAt: new Date().toISOString(),
      author,
    };

    allPosts.unshift(newPost);
    localStorage.setItem(STORAGE_KEYS.FORUM_POSTS, JSON.stringify(allPosts));
    this.emit('FORUM_POST_CREATED', newPost);
    return newPost;
  }

  // Audit Logs
  public getAuditLogs(serverId: string): AuditLogEntry[] {
    const saved = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    let allLogs: AuditLogEntry[] = [];
    if (saved) {
      try {
        allLogs = JSON.parse(saved);
      } catch {}
    }
    return allLogs.filter((l) => l.serverId === serverId);
  }

  public addAuditLog(serverId: string, actorName: string, action: string, target: string): AuditLogEntry {
    const saved = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    const allLogs: AuditLogEntry[] = saved ? JSON.parse(saved) : [];

    const newEntry: AuditLogEntry = {
      id: `log-${Date.now()}`,
      serverId,
      actorName,
      action,
      target,
      timestamp: new Date().toISOString(),
    };

    allLogs.unshift(newEntry);
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(allLogs));
    this.emit('AUDIT_LOG_ADDED', newEntry);
    return newEntry;
  }

  // Telemetry
  public getTelemetry(): TelemetryEvent[] {
    const saved = localStorage.getItem(STORAGE_KEYS.TELEMETRY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  }

  public addTelemetry(event: Omit<TelemetryEvent, 'id' | 'timestamp'>) {
    const all = this.getTelemetry();
    const entry: TelemetryEvent = {
      ...event,
      id: `tel-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    all.unshift(entry);
    localStorage.setItem(STORAGE_KEYS.TELEMETRY, JSON.stringify(all.slice(0, 50)));
    this.emit('TELEMETRY_LOGGED', entry);
  }

  // Stage Channels State
  public getStageState(channelId: string): StageChannelState {
    const saved = localStorage.getItem(STORAGE_KEYS.STAGE_STATES);
    let allStates: Record<string, StageChannelState> = {};
    if (saved) {
      try {
        allStates = JSON.parse(saved);
      } catch {}
    }

    if (!allStates[channelId]) {
      const channel = this.getChannels().find((c) => c.id === channelId);
      const server = channel ? this.getServers().find((s) => s.id === channel.serverId) : null;
      const hostId = server ? server.ownerId : (this.getCurrentUser()?.id || 'host');

      allStates[channelId] = {
        channelId,
        hostId,
        speakers: [hostId],
        handRaisedQueue: [],
        stageSettings: { isOpen: false },
      };
      localStorage.setItem(STORAGE_KEYS.STAGE_STATES, JSON.stringify(allStates));
    }

    return allStates[channelId];
  }

  public canModerateStage(channelId: string, userId: string): boolean {
    const stage = this.getStageState(channelId);
    if (stage.hostId === userId) return true;

    const channel = this.getChannels().find((c) => c.id === channelId);
    if (!channel) return false;

    const members = this.getServerMembers(channel.serverId);
    const member = members.find((m) => m.userId === userId);
    return Boolean(member && (member.role === 'owner' || member.role === 'admin' || member.role === 'moderator'));
  }

  public requestToSpeak(channelId: string, userId: string): { success: boolean; error?: string } {
    const stage = this.getStageState(channelId);
    if (stage.speakers.includes(userId)) {
      return { success: true };
    }
    if (!stage.handRaisedQueue.includes(userId)) {
      stage.handRaisedQueue.push(userId);
      this.saveStageState(channelId, stage);
      this.emit('STAGE_STATE_CHANGED', stage);
    }
    return { success: true };
  }

  public lowerHand(channelId: string, actorUserId: string, targetUserId: string): { success: boolean; error?: string } {
    if (actorUserId !== targetUserId && !this.canModerateStage(channelId, actorUserId)) {
      return { success: false, error: "Unauthorized: Only host or moderators can lower another user's hand" };
    }

    const stage = this.getStageState(channelId);
    stage.handRaisedQueue = stage.handRaisedQueue.filter((id) => id !== targetUserId);
    this.saveStageState(channelId, stage);
    this.emit('STAGE_STATE_CHANGED', stage);
    return { success: true };
  }

  public approveSpeaker(channelId: string, actorUserId: string, targetUserId: string): { success: boolean; error?: string } {
    if (!this.canModerateStage(channelId, actorUserId)) {
      return { success: false, error: 'Unauthorized: Only stage host or moderators can approve speakers' };
    }

    const stage = this.getStageState(channelId);
    stage.handRaisedQueue = stage.handRaisedQueue.filter((id) => id !== targetUserId);
    if (!stage.speakers.includes(targetUserId)) {
      stage.speakers.push(targetUserId);
    }
    this.saveStageState(channelId, stage);
    this.emit('STAGE_STATE_CHANGED', stage);
    this.emit('STAGE_ACTION_APPROVED', { channelId, targetUserId, action: 'invite' });
    return { success: true };
  }

  public denySpeaker(channelId: string, actorUserId: string, targetUserId: string): { success: boolean; error?: string } {
    if (!this.canModerateStage(channelId, actorUserId)) {
      return { success: false, error: 'Unauthorized: Only stage host or moderators can deny speaker requests' };
    }

    const stage = this.getStageState(channelId);
    stage.handRaisedQueue = stage.handRaisedQueue.filter((id) => id !== targetUserId);
    this.saveStageState(channelId, stage);
    this.emit('STAGE_STATE_CHANGED', stage);
    return { success: true };
  }

  public demoteSpeaker(channelId: string, actorUserId: string, targetUserId: string): { success: boolean; error?: string } {
    if (actorUserId !== targetUserId && !this.canModerateStage(channelId, actorUserId)) {
      return { success: false, error: 'Unauthorized: Only stage host or moderators can demote speakers' };
    }

    const stage = this.getStageState(channelId);
    stage.speakers = stage.speakers.filter((id) => id !== targetUserId);
    this.saveStageState(channelId, stage);
    this.emit('STAGE_STATE_CHANGED', stage);
    this.emit('STAGE_ACTION_APPROVED', { channelId, targetUserId, action: 'demote' });
    return { success: true };
  }

  private saveStageState(channelId: string, state: StageChannelState): void {
    const saved = localStorage.getItem(STORAGE_KEYS.STAGE_STATES);
    const allStates = saved ? JSON.parse(saved) : {};
    allStates[channelId] = state;
    localStorage.setItem(STORAGE_KEYS.STAGE_STATES, JSON.stringify(allStates));
  }
}

export const mockStore = new MockStore();
