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
};

// Seed Users
export const SEED_USERS: User[] = [
  {
    id: 'user-divyanshu',
    username: 'divyanshu',
    displayName: 'Divyanshu',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    bio: 'Building next-gen real-time systems & WebRTC video.',
    status: 'online',
    customStatus: { text: 'Building Meetwo V3 🚀', emoji: '💻' },
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'user-alex',
    username: 'alex_r',
    displayName: 'Alex Rivera',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    bio: 'Fullstack Dev & Audio Engineer 🎧',
    status: 'online',
    customStatus: { text: 'Tuning audio DSP matrix', emoji: '🎧' },
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
  {
    id: 'user-sam',
    username: 'sam_chen',
    displayName: 'Sam Chen',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    bio: 'Product Designer & UI tinkerer ✨',
    status: 'idle',
    customStatus: { text: 'Polishing stage UI layouts', emoji: '✨' },
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 'user-elena',
    username: 'elena_v',
    displayName: 'Elena Rostova',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    bio: 'Distributed Systems & WebRTC architect ⚡',
    status: 'dnd',
    customStatus: { text: 'Deep Focus: SFU benchmarks', emoji: '⚡' },
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
];

// Seed Servers
export const SEED_SERVERS: Server[] = [
  {
    id: 'server-mothership',
    name: 'The Mothership',
    iconUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    description: 'Central hub for creative technologists, developers, and creators.',
    ownerId: 'user-divyanshu',
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 'server-dev-guild',
    name: 'Developer Guild',
    iconUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=150&auto=format&fit=crop&q=80',
    description: 'Deep technical discussions, code reviews, and WebRTC experiments.',
    ownerId: 'user-alex',
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
];

// Seed Categories
export const SEED_CATEGORIES: ChannelCategory[] = [
  // Mothership categories
  { id: 'cat-mom-text', serverId: 'server-mothership', name: 'Information & Chat', position: 0 },
  { id: 'cat-mom-voice', serverId: 'server-mothership', name: 'Voice & Hangouts', position: 1 },
  { id: 'cat-mom-stages', serverId: 'server-mothership', name: 'Live Stages & Broadcasts', position: 2 },
  { id: 'cat-mom-forums', serverId: 'server-mothership', name: 'Community Discussions', position: 3 },

  // Dev guild categories
  { id: 'cat-dev-text', serverId: 'server-dev-guild', name: 'Engineering Channels', position: 0 },
  { id: 'cat-dev-voice', serverId: 'server-dev-guild', name: 'Voice Rooms', position: 1 },
  { id: 'cat-dev-stages', serverId: 'server-dev-guild', name: 'Tech Talks & AMAs', position: 2 },
];

// Seed Channels V3 (with Stage, Forum, Announcement types)
export const SEED_CHANNELS: Channel[] = [
  // Mothership
  {
    id: 'chan-announcements',
    serverId: 'server-mothership',
    categoryId: 'cat-mom-text',
    name: 'announcements',
    type: 'announcement',
    topic: 'Official platform news and V3 release updates.',
    position: 0,
    isLocked: true,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 'chan-general',
    serverId: 'server-mothership',
    categoryId: 'cat-mom-text',
    name: 'general',
    type: 'text',
    topic: 'Welcome to The Mothership! Hang out and share ideas.',
    position: 1,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 'chan-random',
    serverId: 'server-mothership',
    categoryId: 'cat-mom-text',
    name: 'random',
    type: 'text',
    topic: 'Off-topic, memes, and casual banter.',
    position: 2,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 'chan-voice-lounge',
    serverId: 'server-mothership',
    categoryId: 'cat-mom-voice',
    name: 'Voice Lounge',
    type: 'voice',
    topic: 'Drop-in voice and video room.',
    position: 3,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 'chan-study-room',
    serverId: 'server-mothership',
    categoryId: 'cat-mom-voice',
    name: 'Study Room',
    type: 'voice',
    topic: 'Co-working and focus session with cameras.',
    position: 4,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 'chan-main-stage',
    serverId: 'server-mothership',
    categoryId: 'cat-mom-stages',
    name: 'Town Hall Stage',
    type: 'stage',
    topic: 'Weekly community AMAs and live keynotes.',
    position: 5,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 'chan-ideas-forum',
    serverId: 'server-mothership',
    categoryId: 'cat-mom-forums',
    name: 'ideas-and-feedback',
    type: 'forum',
    topic: 'Propose feature ideas and vote on product roadmap.',
    position: 6,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },

  // Dev Guild
  {
    id: 'chan-dev-frontend',
    serverId: 'server-dev-guild',
    categoryId: 'cat-dev-text',
    name: 'frontend',
    type: 'text',
    topic: 'React 18/19, TypeScript, and modern styling.',
    position: 0,
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: 'chan-dev-webrtc',
    serverId: 'server-dev-guild',
    categoryId: 'cat-dev-text',
    name: 'webrtc-infra',
    type: 'text',
    topic: 'SDP signaling, ICE trickling, and SFU topologies.',
    position: 1,
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: 'chan-dev-huddle',
    serverId: 'server-dev-guild',
    categoryId: 'cat-dev-voice',
    name: 'Dev Huddle',
    type: 'voice',
    topic: 'Architecture pairing and code review calls.',
    position: 2,
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: 'chan-tech-talks',
    serverId: 'server-dev-guild',
    categoryId: 'cat-dev-stages',
    name: 'Tech Talks Stage',
    type: 'stage',
    topic: 'Live architectural deep-dives with guest speakers.',
    position: 3,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
];

// Seed Members
export const SEED_MEMBERS: ServerMember[] = [
  { serverId: 'server-mothership', userId: 'user-divyanshu', role: 'owner', joinedAt: new Date().toISOString() },
  { serverId: 'server-mothership', userId: 'user-alex', role: 'admin', joinedAt: new Date().toISOString() },
  { serverId: 'server-mothership', userId: 'user-sam', role: 'moderator', joinedAt: new Date().toISOString() },
  { serverId: 'server-mothership', userId: 'user-elena', role: 'member', joinedAt: new Date().toISOString() },

  { serverId: 'server-dev-guild', userId: 'user-alex', role: 'owner', joinedAt: new Date().toISOString() },
  { serverId: 'server-dev-guild', userId: 'user-divyanshu', role: 'admin', joinedAt: new Date().toISOString() },
  { serverId: 'server-dev-guild', userId: 'user-sam', role: 'member', joinedAt: new Date().toISOString() },
];

// Seed Messages
export const SEED_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    channelId: 'chan-general',
    authorId: 'user-alex',
    content: 'Welcome to Meetwo V3 everyone! The Next-Generation Realtime Platform is officially live with Stage Broadcasts, Forums, and Saved Bookmarks 🚀',
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    reactions: [
      { emoji: '🚀', count: 3, userIds: ['user-divyanshu', 'user-sam', 'user-elena'] },
      { emoji: '🔥', count: 2, userIds: ['user-divyanshu', 'user-alex'] },
    ],
  },
  {
    id: 'msg-2',
    channelId: 'chan-general',
    authorId: 'user-sam',
    content: 'The new **Town Hall Stage** allows speakers to present while hundreds of listeners join in without CPU overload. Try joining it from the channel list! ✨',
    createdAt: new Date(Date.now() - 3600000 * 2.2).toISOString(),
    reactions: [
      { emoji: '✨', count: 2, userIds: ['user-alex', 'user-divyanshu'] },
      { emoji: '❤️', count: 1, userIds: ['user-divyanshu'] },
    ],
  },
  {
    id: 'msg-3',
    channelId: 'chan-general',
    authorId: 'user-divyanshu',
    content: 'Notice how you can now ⭐ Bookmark any message into your personal Saved list, or open a dedicated Thread drawer for deep discussion.',
    createdAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    isPinned: true,
    reactions: [
      { emoji: '👏', count: 2, userIds: ['user-sam', 'user-alex'] },
    ],
  },
  {
    id: 'msg-4',
    channelId: 'chan-general',
    authorId: 'user-elena',
    content: 'The media recovery engine automatically recovers if you swap networks or minimize your browser. Pure resilience!',
    replyToId: 'msg-3',
    replyTo: {
      id: 'msg-3',
      authorName: 'Divyanshu',
      content: 'Notice how you can now ⭐ Bookmark any message...',
    },
    createdAt: new Date(Date.now() - 3600000 * 0.5).toISOString(),
    reactions: [
      { emoji: '⚡', count: 3, userIds: ['user-divyanshu', 'user-sam', 'user-alex'] },
    ],
  },
];

// Seed Forum Posts
export const SEED_FORUM_POSTS: ForumPost[] = [
  {
    id: 'post-1',
    channelId: 'chan-ideas-forum',
    authorId: 'user-sam',
    title: 'How should we handle 4K Screen Share frame rates?',
    content: 'With 1080p camera capture working seamlessly, for text-heavy screen sharing we can drop to 15fps to conserve massive bandwidth while keeping crisp 4K text legibility.',
    tags: ['webrtc', 'performance', 'video'],
    repliesCount: 4,
    isSolved: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'post-2',
    channelId: 'chan-ideas-forum',
    authorId: 'user-alex',
    title: 'Noise Suppression: RNNoise vs Web Audio DSP Biquad Filters',
    content: 'Exploring browser WebAssembly RNNoise integration to eliminate keyboard clicks during voice calls.',
    tags: ['audio', 'dsp', 'ai'],
    repliesCount: 7,
    isSolved: false,
    createdAt: new Date(Date.now() - 43200000).toISOString(),
  },
];

// Seed Audit Logs
export const SEED_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'log-1',
    serverId: 'server-mothership',
    actorName: 'Divyanshu',
    action: 'Created Stage Channel',
    target: '#Town Hall Stage',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'log-2',
    serverId: 'server-mothership',
    actorName: 'Alex Rivera',
    action: 'Updated Server Permissions',
    target: 'Moderator Role',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'log-3',
    serverId: 'server-mothership',
    actorName: 'Sam Chen',
    action: 'Pinned Message',
    target: 'Notice how you can now ⭐ Bookmark...',
    timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
  },
];

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

  private notifyLocal(type: string, payload: any) {
    const callbacks = this.listeners.get(type);
    if (callbacks) {
      callbacks.forEach((cb) => cb(payload));
    }
  }

  // Current User & Custom Status
  public getCurrentUser(): User {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    const defaultUser = SEED_USERS[0];
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(defaultUser));
    return defaultUser;
  }

  public setCurrentUser(user: User) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    this.emit('USER_UPDATED', user);
  }

  public updateCustomStatus(status: CustomStatus | undefined) {
    const user = this.getCurrentUser();
    user.customStatus = status;
    this.setCurrentUser(user);
  }

  // Servers
  public getServers(): Server[] {
    const saved = localStorage.getItem(STORAGE_KEYS.SERVERS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    localStorage.setItem(STORAGE_KEYS.SERVERS, JSON.stringify(SEED_SERVERS));
    return SEED_SERVERS;
  }

  public createServer(name: string, iconUrl?: string): Server {
    const servers = this.getServers();
    const currentUser = this.getCurrentUser();
    const newServer: Server = {
      id: `server-${Date.now()}`,
      name,
      iconUrl: iconUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${name}`,
      description: `${name} community`,
      ownerId: currentUser.id,
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
      userId: currentUser.id,
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
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(SEED_CATEGORIES));
    return SEED_CATEGORIES;
  }

  // Channels V3
  public getChannels(): Channel[] {
    const saved = localStorage.getItem(STORAGE_KEYS.CHANNELS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(SEED_CHANNELS));
    return SEED_CHANNELS;
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
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(SEED_MEMBERS));
    return SEED_MEMBERS;
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

  public getAllUsers(): User[] {
    const currentUser = this.getCurrentUser();
    const userMap = new Map<string, User>();
    SEED_USERS.forEach((u) => userMap.set(u.id, u));
    userMap.set(currentUser.id, currentUser);
    return Array.from(userMap.values());
  }

  // Messages V3
  public getMessages(channelId: string): Message[] {
    const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    let allMessages: Message[] = [];
    if (saved) {
      try {
        allMessages = JSON.parse(saved);
      } catch {
        allMessages = SEED_MESSAGES;
      }
    } else {
      allMessages = SEED_MESSAGES;
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(allMessages));
    }

    const users = this.getAllUsers();
    const bookmarks = this.getBookmarks();
    const currentUserId = this.getCurrentUser().id;

    return allMessages
      .filter((m) => m.channelId === channelId)
      .map((m) => ({
        ...m,
        isBookmarked: bookmarks.some((b) => b.messageId === m.id && b.userId === currentUserId),
        author: users.find((u) => u.id === m.authorId) || {
          id: m.authorId,
          username: 'unknown',
          displayName: 'User',
          status: 'online',
          createdAt: new Date().toISOString(),
        },
      }))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  public sendMessage(
    channelId: string,
    content: string,
    replyToId?: string | null,
    attachments?: Attachment[]
  ): Message {
    const currentUser = this.getCurrentUser();
    const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    let allMessages: Message[] = saved ? JSON.parse(saved) : SEED_MESSAGES;

    let replyToObj = undefined;
    if (replyToId) {
      const parent = allMessages.find((m) => m.id === replyToId);
      if (parent) {
        const users = this.getAllUsers();
        const parentAuthor = users.find((u) => u.id === parent.authorId);
        replyToObj = {
          id: parent.id,
          authorName: parentAuthor?.displayName || parentAuthor?.username || 'User',
          content: parent.content.slice(0, 60),
        };
      }
    }

    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      channelId,
      authorId: currentUser.id,
      content,
      replyToId: replyToId || null,
      replyTo: replyToObj || null,
      reactions: [],
      attachments: attachments || [],
      createdAt: new Date().toISOString(),
      author: currentUser,
    };

    allMessages.push(newMessage);
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(allMessages));
    this.emit('NEW_MESSAGE', newMessage);
    return newMessage;
  }

  public editMessage(messageId: string, newContent: string): Message | null {
    const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    let allMessages: Message[] = saved ? JSON.parse(saved) : SEED_MESSAGES;

    const idx = allMessages.findIndex((m) => m.id === messageId);
    if (idx === -1) return null;

    allMessages[idx] = {
      ...allMessages[idx],
      content: newContent,
      isEdited: true,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(allMessages));
    this.emit('MESSAGE_EDITED', allMessages[idx]);
    return allMessages[idx];
  }

  public deleteMessage(messageId: string): boolean {
    const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    let allMessages: Message[] = saved ? JSON.parse(saved) : SEED_MESSAGES;

    const filtered = allMessages.filter((m) => m.id !== messageId);
    if (filtered.length === allMessages.length) return false;

    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(filtered));
    this.emit('MESSAGE_DELETED', { messageId });
    return true;
  }

  public toggleReaction(messageId: string, emoji: string): Message | null {
    const currentUser = this.getCurrentUser();
    const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    let allMessages: Message[] = saved ? JSON.parse(saved) : SEED_MESSAGES;

    const idx = allMessages.findIndex((m) => m.id === messageId);
    if (idx === -1) return null;

    const msg = allMessages[idx];
    const reactions = msg.reactions ? [...msg.reactions] : [];
    const rIdx = reactions.findIndex((r) => r.emoji === emoji);

    if (rIdx >= 0) {
      const existing = reactions[rIdx];
      const hasReacted = existing.userIds.includes(currentUser.id);

      if (hasReacted) {
        const updatedUserIds = existing.userIds.filter((id) => id !== currentUser.id);
        if (updatedUserIds.length === 0) {
          reactions.splice(rIdx, 1);
        } else {
          reactions[rIdx] = { ...existing, count: updatedUserIds.length, userIds: updatedUserIds };
        }
      } else {
        reactions[rIdx] = { ...existing, count: existing.count + 1, userIds: [...existing.userIds, currentUser.id] };
      }
    } else {
      reactions.push({ emoji, count: 1, userIds: [currentUser.id] });
    }

    allMessages[idx] = { ...msg, reactions };
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(allMessages));
    this.emit('REACTION_TOGGLED', { messageId, reactions });
    return allMessages[idx];
  }

  // Bookmarks (⭐ Saved Messages)
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
    const currentUser = this.getCurrentUser();
    const bookmarks = this.getBookmarks();
    const existingIdx = bookmarks.findIndex((b) => b.messageId === message.id && b.userId === currentUser.id);

    if (existingIdx >= 0) {
      bookmarks.splice(existingIdx, 1);
      localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
      this.emit('BOOKMARKS_UPDATED', bookmarks);
      return false;
    } else {
      const newBm: Bookmark = {
        id: `bm-${Date.now()}`,
        userId: currentUser.id,
        messageId: message.id,
        message,
        channelName,
        createdAt: new Date().toISOString(),
      };
      bookmarks.push(newBm);
      localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
      this.emit('BOOKMARKS_UPDATED', bookmarks);
      return true;
    }
  }

  // Forum Posts V3
  public getForumPosts(channelId: string): ForumPost[] {
    const saved = localStorage.getItem(STORAGE_KEYS.FORUM_POSTS);
    let allPosts: ForumPost[] = [];
    if (saved) {
      try {
        allPosts = JSON.parse(saved);
      } catch {
        allPosts = SEED_FORUM_POSTS;
      }
    } else {
      allPosts = SEED_FORUM_POSTS;
      localStorage.setItem(STORAGE_KEYS.FORUM_POSTS, JSON.stringify(allPosts));
    }

    const users = this.getAllUsers();
    return allPosts
      .filter((p) => p.channelId === channelId)
      .map((p) => ({
        ...p,
        author: users.find((u) => u.id === p.authorId),
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public createForumPost(channelId: string, title: string, content: string, tags: string[]): ForumPost {
    const currentUser = this.getCurrentUser();
    const saved = localStorage.getItem(STORAGE_KEYS.FORUM_POSTS);
    let allPosts: ForumPost[] = saved ? JSON.parse(saved) : SEED_FORUM_POSTS;

    const newPost: ForumPost = {
      id: `post-${Date.now()}`,
      channelId,
      authorId: currentUser.id,
      title,
      content,
      tags: tags.length > 0 ? tags : ['discussion'],
      repliesCount: 0,
      isSolved: false,
      createdAt: new Date().toISOString(),
      author: currentUser,
    };

    allPosts.unshift(newPost);
    localStorage.setItem(STORAGE_KEYS.FORUM_POSTS, JSON.stringify(allPosts));
    this.emit('FORUM_POST_CREATED', newPost);
    return newPost;
  }

  // Audit Logs V3
  public getAuditLogs(serverId: string): AuditLogEntry[] {
    const saved = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    let allLogs: AuditLogEntry[] = saved ? JSON.parse(saved) : SEED_AUDIT_LOGS;
    return allLogs.filter((l) => l.serverId === serverId);
  }

  public addAuditLog(serverId: string, action: string, target: string): AuditLogEntry {
    const currentUser = this.getCurrentUser();
    const saved = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    let allLogs: AuditLogEntry[] = saved ? JSON.parse(saved) : SEED_AUDIT_LOGS;

    const newLog: AuditLogEntry = {
      id: `log-${Date.now()}`,
      serverId,
      actorName: currentUser.displayName || currentUser.username,
      action,
      target,
      timestamp: new Date().toISOString(),
    };

    allLogs.unshift(newLog);
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(allLogs));
    return newLog;
  }

  // Invites
  public createInvite(serverId: string): Invite {
    const currentUser = this.getCurrentUser();
    const saved = localStorage.getItem(STORAGE_KEYS.INVITES);
    let allInvites: Invite[] = saved ? JSON.parse(saved) : [];

    const newInvite: Invite = {
      id: `inv-${Date.now()}`,
      serverId,
      code: Math.random().toString(36).substring(2, 8).toUpperCase(),
      creatorId: currentUser.id,
      usesCount: 0,
      createdAt: new Date().toISOString(),
    };

    allInvites.push(newInvite);
    localStorage.setItem(STORAGE_KEYS.INVITES, JSON.stringify(allInvites));
    return newInvite;
  }
}

export const mockStore = new MockStore();
