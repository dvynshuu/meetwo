import { supabase } from '../supabase/client';
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
  MessageReaction,
  AuditLogEntry,
} from '../../types';
import {
  ServiceError,
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

export const formatReactions = (rawReactions: any[]): MessageReaction[] => {
  if (!rawReactions || !Array.isArray(rawReactions)) return [];
  const map = new Map<string, { emoji: string; count: number; userIds: string[] }>();

  for (const r of rawReactions) {
    if (!r || !r.emoji) continue;
    const uid = r.user_id || r.userId;
    const existing = map.get(r.emoji);
    if (existing) {
      if (uid && !existing.userIds.includes(uid)) {
        existing.userIds.push(uid);
        existing.count += 1;
      }
    } else {
      map.set(r.emoji, {
        emoji: r.emoji,
        count: 1,
        userIds: uid ? [uid] : [],
      });
    }
  }

  return Array.from(map.values());
};

const mapChannel = (c: any): Channel => ({
  ...c,
  id: c.id,
  serverId: c.serverId || c.server_id,
  name: c.name,
  type: c.type,
  topic: c.topic || '',
  categoryId: c.categoryId || c.category_id || undefined,
  position: c.position ?? 0,
  createdAt: c.createdAt || c.created_at,
});

export class SupabaseMessageRepository implements IMessageRepository {
  async getMessages(channelId: string): Promise<Message[]> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');
    if (!channelId) return [];

    const { data, error } = await supabase
      .from('messages')
      .select('*, author:profiles(*), reactions:message_reactions(*), attachments(*)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new ServiceError('MESSAGE_FETCH_FAILED', `Failed to load messages: ${error.message}`, error);
    }

    return (data || []).map((m: any) => ({
      id: m.id,
      channelId: m.channel_id,
      authorId: m.author_id,
      content: m.content,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
      isEdited: m.is_edited,
      replyToId: m.reply_to_id,
      author: m.author
        ? {
            id: m.author.id,
            username: m.author.username,
            displayName: m.author.display_name,
            avatarUrl: m.author.avatar_url,
            bio: m.author.bio,
            status: m.author.status || 'online',
            createdAt: m.author.created_at,
          }
        : undefined,
      reactions: formatReactions(m.reactions),
      attachments: (m.attachments || []).map((a: any) => ({
        id: a.id,
        fileName: a.file_name,
        fileUrl: a.file_url,
        fileSize: Number(a.file_size || 0),
        contentType: a.content_type,
      })),
    }));
  }

  async sendMessage(
    channelId: string,
    author: User,
    content: string,
    replyToId?: string | null,
    attachments?: Attachment[]
  ): Promise<Message> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const cleanContent = content.trim();
    const { data: newMsg, error: msgErr } = await supabase
      .from('messages')
      .insert({
        channel_id: channelId,
        author_id: author.id,
        content: cleanContent,
        reply_to_id: replyToId || null,
      })
      .select('*, author:profiles(*)')
      .single();

    if (msgErr) {
      throw new ServiceError('MESSAGE_SEND_FAILED', `Failed to send message: ${msgErr.message}`, msgErr);
    }

    let savedAttachments: Attachment[] = [];
    if (attachments && attachments.length > 0 && newMsg?.id) {
      const insertPayloads = attachments.map((a) => ({
        message_id: newMsg.id,
        file_name: a.fileName,
        file_url: a.fileUrl,
        file_size: a.fileSize,
        content_type: a.contentType,
      }));

      const { data: attData, error: attErr } = await supabase
        .from('attachments')
        .insert(insertPayloads)
        .select('*');

      if (!attErr && attData) {
        savedAttachments = attData.map((a: any) => ({
          id: a.id,
          fileName: a.file_name,
          fileUrl: a.file_url,
          fileSize: Number(a.file_size || 0),
          contentType: a.content_type,
        }));
      }
    }

    return {
      id: newMsg.id,
      channelId: newMsg.channel_id,
      authorId: newMsg.author_id,
      content: newMsg.content,
      createdAt: newMsg.created_at,
      isEdited: false,
      replyToId: newMsg.reply_to_id,
      reactions: [],
      attachments: savedAttachments.length > 0 ? savedAttachments : (attachments || []),
      author: newMsg.author
        ? {
            id: newMsg.author.id,
            username: newMsg.author.username,
            displayName: newMsg.author.display_name,
            avatarUrl: newMsg.author.avatar_url,
            bio: newMsg.author.bio,
            status: newMsg.author.status || 'online',
            createdAt: newMsg.author.created_at,
          }
        : author,
    };
  }

  async editMessage(messageId: string, authorId: string, content: string): Promise<void> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');
    const clean = content.trim();
    if (!clean) return;

    const { error } = await supabase
      .from('messages')
      .update({
        content: clean,
        is_edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .eq('author_id', authorId);

    if (error) {
      throw new ServiceError('MESSAGE_EDIT_FAILED', `Failed to edit message: ${error.message}`, error);
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (error) {
      throw new ServiceError('MESSAGE_DELETE_FAILED', `Failed to delete message: ${error.message}`, error);
    }
  }

  async toggleReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const { data: existing } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from('message_reactions').delete().eq('id', existing.id);
      if (error) {
        throw new ServiceError('REACTION_FAILED', `Failed to remove reaction: ${error.message}`, error);
      }
    } else {
      const { error } = await supabase.from('message_reactions').insert({
        message_id: messageId,
        user_id: userId,
        emoji,
      });
      if (error) {
        throw new ServiceError('REACTION_FAILED', `Failed to add reaction: ${error.message}`, error);
      }
    }
  }
}

export class SupabaseServerRepository implements IServerRepository {
  async getServers(): Promise<Server[]> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const { data, error } = await supabase
      .from('servers')
      .select('*, channels(*)')
      .order('created_at', { ascending: true });

    if (error) {
      throw new ServiceError('SERVER_LOAD_FAILED', `Failed to load servers: ${error.message}`, error);
    }

    return (data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      iconUrl: s.icon_url,
      description: s.description,
      ownerId: s.owner_id,
      createdAt: s.created_at,
      channels: (s.channels || []).map(mapChannel),
    }));
  }

  async createServer(name: string, ownerId: string, iconUrl?: string): Promise<Server> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const { data: server, error } = await supabase
      .from('servers')
      .insert({
        name,
        icon_url: iconUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${name}`,
        owner_id: ownerId,
      })
      .select()
      .single();

    if (error) {
      throw new ServiceError('SERVER_CREATE_FAILED', `Failed to create server: ${error.message}`, error);
    }

    // Owner membership
    await supabase.from('server_members').insert({
      server_id: server.id,
      user_id: ownerId,
      role: 'owner',
    });

    // Default general channel
    const { data: generalChan } = await supabase
      .from('channels')
      .insert({
        server_id: server.id,
        name: 'general',
        type: 'text',
        position: 0,
      })
      .select()
      .single();

    return {
      id: server.id,
      name: server.name,
      iconUrl: server.icon_url,
      description: server.description,
      ownerId: server.owner_id,
      createdAt: server.created_at,
      channels: generalChan ? [mapChannel(generalChan)] : [],
    };
  }

  async getServerMembers(serverId: string): Promise<ServerMember[]> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const { data, error } = await supabase
      .from('server_members')
      .select('*, profiles:user_id(*)')
      .eq('server_id', serverId);

    if (error) {
      throw new ServiceError('MEMBER_LOAD_FAILED', `Failed to load members: ${error.message}`, error);
    }

    return (data || []).map((m: any) => ({
      serverId: m.server_id,
      userId: m.user_id,
      role: m.role || 'member',
      joinedAt: m.joined_at,
      user: m.profiles
        ? {
            id: m.profiles.id,
            username: m.profiles.username,
            displayName: m.profiles.display_name || m.profiles.username,
            avatarUrl: m.profiles.avatar_url,
            status: m.profiles.status || 'online',
            createdAt: m.profiles.created_at,
          }
        : undefined,
    }));
  }

  async createInvite(
    serverId: string,
    creatorId: string,
    options?: { maxUses?: number; expiresInHours?: number }
  ): Promise<Invite> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = options?.expiresInHours
      ? new Date(Date.now() + options.expiresInHours * 3600000).toISOString()
      : null;

    const { data, error } = await supabase
      .from('invites')
      .insert({
        server_id: serverId,
        code,
        creator_id: creatorId,
        max_uses: options?.maxUses || null,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      throw new ServiceError('INVITE_CREATE_FAILED', `Failed to create invite: ${error.message}`, error);
    }

    return {
      id: data.id,
      serverId: data.server_id,
      code: data.code,
      creatorId: data.creator_id,
      maxUses: data.max_uses,
      expiresAt: data.expires_at,
      usesCount: data.uses_count || 0,
      createdAt: data.created_at,
    };
  }

  async resolveInvite(code: string): Promise<ResolvedInvite | null> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) return null;

    const { data: invData, error: invErr } = await supabase
      .from('invites')
      .select('*, server:servers(*)')
      .eq('code', cleanCode)
      .maybeSingle();

    if (invErr || !invData) return null;

    const serverObj: Server = {
      id: invData.server.id,
      name: invData.server.name,
      iconUrl: invData.server.icon_url,
      description: invData.server.description,
      ownerId: invData.server.owner_id,
      createdAt: invData.server.created_at,
    };

    const { count: memberCount } = await supabase
      .from('server_members')
      .select('*', { count: 'exact', head: true })
      .eq('server_id', serverObj.id);

    return {
      invite: {
        id: invData.id,
        serverId: invData.server_id,
        code: invData.code,
        creatorId: invData.creator_id,
        expiresAt: invData.expires_at,
        usesCount: invData.uses_count || 0,
        maxUses: invData.max_uses,
        createdAt: invData.created_at,
      },
      server: serverObj,
      memberCount: memberCount || 1,
    };
  }

  async acceptInvite(code: string): Promise<{ server: Server; channelId?: string }> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');
    const cleanCode = (code || '').trim().toUpperCase();

    // Call atomic PostgreSQL RPC function
    const { data, error } = await supabase.rpc('join_server_with_invite', { p_code: cleanCode });

    if (error) {
      throw new ServiceError('INVITE_ACCEPT_FAILED', error.message || 'Failed to accept invite.');
    }

    const sData = data as any;
    const server: Server = {
      id: sData.server_id,
      name: sData.server_name,
      iconUrl: sData.icon_url,
      ownerId: '',
      createdAt: new Date().toISOString(),
    };

    // Find first channel in server
    const { data: chanData } = await supabase
      .from('channels')
      .select('id')
      .eq('server_id', server.id)
      .order('position', { ascending: true })
      .limit(1);

    const firstChannelId = chanData && chanData[0] ? String(chanData[0].id) : undefined;

    return { server, channelId: firstChannelId };
  }

  async getAuditLogs(_serverId: string): Promise<AuditLogEntry[]> {
    // Audit logs for remote Supabase workspaces
    return [];
  }
}

export class SupabaseChannelRepository implements IChannelRepository {
  async getChannels(serverId: string): Promise<Channel[]> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('server_id', serverId)
      .order('position', { ascending: true });

    if (error) {
      throw new ServiceError('CHANNEL_LOAD_FAILED', `Failed to load channels: ${error.message}`, error);
    }

    return (data || []).map(mapChannel);
  }

  async getAllChannels(): Promise<Channel[]> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .order('position', { ascending: true });

    if (error) {
      throw new ServiceError('CHANNEL_LOAD_FAILED', `Failed to load all channels: ${error.message}`, error);
    }

    return (data || []).map(mapChannel);
  }

  async createChannel(
    serverId: string,
    name: string,
    type: ChannelType,
    topic?: string,
    categoryId?: string
  ): Promise<Channel> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const payload: Record<string, any> = {
      server_id: serverId,
      name: name.toLowerCase().replace(/\s+/g, '-'),
      type,
      topic: topic || '',
    };
    if (categoryId) payload.category_id = categoryId;

    const { data, error } = await supabase.from('channels').insert(payload).select().single();
    if (error) {
      throw new ServiceError('CHANNEL_CREATE_FAILED', `Failed to create channel: ${error.message}`, error);
    }

    return mapChannel(data);
  }

  async getCategories(serverId: string): Promise<ChannelCategory[]> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('server_id', serverId)
      .order('position', { ascending: true });

    if (error) {
      throw new ServiceError('CATEGORY_LOAD_FAILED', `Failed to load categories: ${error.message}`, error);
    }

    return (data || []).map((c: any) => ({
      id: c.id,
      serverId: c.server_id,
      name: c.name,
      position: c.position || 0,
    }));
  }

  async createCategory(serverId: string, name: string): Promise<ChannelCategory> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const { data, error } = await supabase
      .from('categories')
      .insert({ server_id: serverId, name: name.trim() })
      .select()
      .single();

    if (error) {
      throw new ServiceError('CATEGORY_CREATE_FAILED', `Failed to create category: ${error.message}`, error);
    }

    return {
      id: data.id,
      serverId: data.server_id,
      name: data.name,
      position: data.position || 0,
    };
  }
}

export class SupabaseDMRepository implements IDMRepository {
  async getConversations(userId: string): Promise<DMConversation[]> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const { data: participations, error } = await supabase
      .from('dm_participants')
      .select('conversation_id')
      .eq('user_id', userId);

    if (error) {
      throw new ServiceError('DM_LOAD_FAILED', `Failed to load DM conversations: ${error.message}`, error);
    }

    if (!participations || participations.length === 0) return [];
    const conversationIds = participations.map((p: any) => p.conversation_id);

    const { data: allParticipants } = await supabase
      .from('dm_participants')
      .select('conversation_id, user:profiles(*)')
      .in('conversation_id', conversationIds);

    const { data: latestMessages } = await supabase
      .from('dm_messages')
      .select('*, author:profiles(*)')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false });

    const conversations: DMConversation[] = [];

    for (const cId of conversationIds) {
      const participantsForConvo = (allParticipants || [])
        .filter((p: any) => p.conversation_id === cId)
        .map((p: any) => ({
          id: p.user?.id,
          username: p.user?.username,
          displayName: p.user?.display_name || p.user?.username || 'Member',
          avatarUrl: p.user?.avatar_url,
          status: p.user?.status || 'online',
          createdAt: p.user?.created_at,
        }))
        .filter((u: any) => u.id && u.id !== userId);

      const lastMsgRow = (latestMessages || []).find((m: any) => m.conversation_id === cId);
      const lastMessage: DMMessage | undefined = lastMsgRow
        ? {
            id: lastMsgRow.id,
            conversationId: lastMsgRow.conversation_id,
            authorId: lastMsgRow.author_id,
            content: lastMsgRow.content,
            createdAt: lastMsgRow.created_at,
            author: lastMsgRow.author
              ? {
                  id: lastMsgRow.author.id,
                  username: lastMsgRow.author.username,
                  displayName: lastMsgRow.author.display_name,
                  avatarUrl: lastMsgRow.author.avatar_url,
                  status: lastMsgRow.author.status || 'online',
                  createdAt: lastMsgRow.author.created_at,
                }
              : undefined,
          }
        : undefined;

      conversations.push({
        id: cId,
        participants: participantsForConvo,
        lastMessage,
        unreadCount: 0,
        createdAt: new Date().toISOString(),
      });
    }

    return conversations;
  }

  async getMessages(conversationId: string): Promise<DMMessage[]> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const { data, error } = await supabase
      .from('dm_messages')
      .select('*, author:profiles(*)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new ServiceError('DM_MESSAGES_LOAD_FAILED', `Failed to load DM messages: ${error.message}`, error);
    }

    return (data || []).map((m: any) => ({
      id: m.id,
      conversationId: m.conversation_id,
      authorId: m.author_id,
      content: m.content,
      createdAt: m.created_at,
      author: m.author
        ? {
            id: m.author.id,
            username: m.author.username,
            displayName: m.author.display_name,
            avatarUrl: m.author.avatar_url,
            status: m.author.status || 'online',
            createdAt: m.author.created_at,
          }
        : undefined,
    }));
  }

  async sendMessage(conversationId: string, author: User, content: string): Promise<DMMessage> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');
    const cleanContent = content.trim();
    if (!cleanContent) throw new ServiceError('INVALID_CONTENT', 'DM content cannot be empty.');

    const { data, error } = await supabase
      .from('dm_messages')
      .insert({
        conversation_id: conversationId,
        author_id: author.id,
        content: cleanContent,
      })
      .select('*, author:profiles(*)')
      .single();

    if (error) {
      throw new ServiceError('DM_SEND_FAILED', `Failed to send DM: ${error.message}`, error);
    }

    return {
      id: data.id,
      conversationId: data.conversation_id,
      authorId: data.author_id,
      content: data.content,
      createdAt: data.created_at,
      author: data.author
        ? {
            id: data.author.id,
            username: data.author.username,
            displayName: data.author.display_name,
            avatarUrl: data.author.avatar_url,
            status: data.author.status || 'online',
            createdAt: data.author.created_at,
          }
        : author,
    };
  }

  async startConversation(currentUser: User, targetUser: User): Promise<string> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    // Look for existing conversation between both
    const { data: myConvos } = await supabase
      .from('dm_participants')
      .select('conversation_id')
      .eq('user_id', currentUser.id);

    if (myConvos && myConvos.length > 0) {
      const myIds = myConvos.map((c: any) => c.conversation_id);
      const { data: sharedConvo } = await supabase
        .from('dm_participants')
        .select('conversation_id')
        .in('conversation_id', myIds)
        .eq('user_id', targetUser.id)
        .maybeSingle();

      if (sharedConvo?.conversation_id) {
        return sharedConvo.conversation_id;
      }
    }

    // Create new conversation row
    const { data: newConvo, error: convoErr } = await supabase
      .from('dm_conversations')
      .insert({})
      .select('id')
      .single();

    if (convoErr) {
      throw new ServiceError('DM_CREATE_FAILED', `Failed to create DM conversation: ${convoErr.message}`, convoErr);
    }

    await supabase.from('dm_participants').insert([
      { conversation_id: newConvo.id, user_id: currentUser.id },
      { conversation_id: newConvo.id, user_id: targetUser.id },
    ]);

    return newConvo.id;
  }
}

export class SupabaseBookmarkRepository implements IBookmarkRepository {
  async getBookmarks(userId: string): Promise<Bookmark[]> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const { data, error } = await supabase
      .from('bookmarks')
      .select(`
        id,
        user_id,
        message_id,
        channel_name,
        created_at,
        message:messages(
          id,
          channel_id,
          author_id,
          content,
          created_at,
          is_edited,
          author:profiles(*)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new ServiceError('BOOKMARK_LOAD_FAILED', `Failed to load bookmarks: ${error.message}`, error);
    }

    return (data || [])
      .filter((row: any) => row.message)
      .map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        messageId: row.message_id,
        channelName: row.channel_name || 'chat',
        createdAt: row.created_at,
        message: {
          id: row.message.id,
          channelId: row.message.channel_id,
          authorId: row.message.author_id,
          content: row.message.content,
          createdAt: row.message.created_at,
          isEdited: row.message.is_edited,
          author: row.message.author
            ? {
                id: row.message.author.id,
                username: row.message.author.username,
                displayName: row.message.author.display_name,
                avatarUrl: row.message.author.avatar_url,
                status: row.message.author.status || 'online',
                createdAt: row.message.author.created_at,
              }
            : undefined,
        },
      }));
  }

  async toggleBookmark(userId: string, message: Message, channelName: string = 'general'): Promise<boolean> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const { data: existing } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('user_id', userId)
      .eq('message_id', message.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from('bookmarks').delete().eq('id', existing.id);
      if (error) throw new ServiceError('BOOKMARK_TOGGLE_FAILED', error.message, error);
      return false;
    } else {
      const { error } = await supabase.from('bookmarks').insert({
        user_id: userId,
        message_id: message.id,
        channel_name: channelName,
      });
      if (error) throw new ServiceError('BOOKMARK_TOGGLE_FAILED', error.message, error);
      return true;
    }
  }

  async isBookmarked(userId: string, messageId: string): Promise<boolean> {
    if (!supabase) return false;
    const { data } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('user_id', userId)
      .eq('message_id', messageId)
      .maybeSingle();
    return Boolean(data);
  }
}

export class SupabaseThreadRepository implements IThreadRepository {
  async getReplies(parentMessageId: string, channelId: string): Promise<ThreadReplyItem[]> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const { data: thread, error: threadErr } = await supabase
      .from('threads')
      .select('id')
      .eq('parent_message_id', parentMessageId)
      .maybeSingle();

    if (threadErr) {
      throw new ServiceError('THREAD_LOAD_FAILED', `Failed to load thread: ${threadErr.message}`, threadErr);
    }

    if (!thread) return [];

    const { data: messages, error } = await supabase
      .from('thread_messages')
      .select('*, author:profiles(*)')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true });

    if (error) {
      throw new ServiceError('THREAD_MESSAGES_LOAD_FAILED', error.message, error);
    }

    return (messages || []).map((m: any) => ({
      id: m.id,
      authorId: m.author_id,
      authorName: m.author?.display_name || m.author?.username || 'Member',
      avatarUrl: m.author?.avatar_url,
      content: m.content,
      createdAt: m.created_at,
    }));
  }

  async sendReply(parentMessageId: string, channelId: string, author: User, content: string): Promise<ThreadReplyItem> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');
    const cleanContent = content.trim();
    if (!cleanContent) throw new ServiceError('INVALID_CONTENT', 'Reply content cannot be empty.');

    // Find or create thread
    let { data: thread } = await supabase
      .from('threads')
      .select('id')
      .eq('parent_message_id', parentMessageId)
      .maybeSingle();

    if (!thread) {
      const { data: newThread, error: createErr } = await supabase
        .from('threads')
        .insert({
          parent_message_id: parentMessageId,
          channel_id: channelId,
        })
        .select('id')
        .single();

      if (createErr && !createErr.message?.includes('duplicate')) {
        throw new ServiceError('THREAD_CREATE_FAILED', createErr.message, createErr);
      }
      thread = newThread;
    }

    if (!thread?.id) {
      throw new ServiceError('THREAD_CREATE_FAILED', 'Could not resolve parent thread.');
    }

    const { data: newMsg, error: msgErr } = await supabase
      .from('thread_messages')
      .insert({
        thread_id: thread.id,
        author_id: author.id,
        content: cleanContent,
      })
      .select('*, author:profiles(*)')
      .single();

    if (msgErr) {
      throw new ServiceError('THREAD_REPLY_FAILED', msgErr.message, msgErr);
    }

    return {
      id: newMsg.id,
      authorId: newMsg.author_id,
      authorName: newMsg.author?.display_name || author.displayName || author.username,
      avatarUrl: newMsg.author?.avatar_url || author.avatarUrl,
      content: newMsg.content,
      createdAt: newMsg.created_at,
    };
  }
}

export class SupabaseForumRepository implements IForumRepository {
  async getPosts(channelId: string): Promise<ForumPost[]> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const { data, error } = await supabase
      .from('forum_posts')
      .select('*, author:profiles(*), replies:forum_replies(id)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new ServiceError('FORUM_LOAD_FAILED', `Failed to load forum posts: ${error.message}`, error);
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      channelId: p.channel_id,
      authorId: p.author_id,
      title: p.title,
      content: p.content,
      tags: Array.isArray(p.tags) ? p.tags : [],
      repliesCount: Array.isArray(p.replies) ? p.replies.length : 0,
      isSolved: Boolean(p.is_solved),
      createdAt: p.created_at,
      author: p.author
        ? {
            id: p.author.id,
            username: p.author.username,
            displayName: p.author.display_name,
            avatarUrl: p.author.avatar_url,
            status: p.author.status || 'online',
            createdAt: p.author.created_at,
          }
        : undefined,
    }));
  }

  async createPost(channelId: string, author: User, title: string, content: string, tags: string[] = []): Promise<ForumPost> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const { data, error } = await supabase
      .from('forum_posts')
      .insert({
        channel_id: channelId,
        author_id: author.id,
        title: title.trim(),
        content: content.trim(),
        tags,
        is_solved: false,
      })
      .select('*, author:profiles(*)')
      .single();

    if (error) {
      throw new ServiceError('FORUM_POST_CREATE_FAILED', error.message, error);
    }

    return {
      id: data.id,
      channelId: data.channel_id,
      authorId: data.author_id,
      title: data.title,
      content: data.content,
      tags: data.tags || [],
      repliesCount: 0,
      isSolved: false,
      createdAt: data.created_at,
      author: data.author
        ? {
            id: data.author.id,
            username: data.author.username,
            displayName: data.author.display_name,
            avatarUrl: data.author.avatar_url,
            status: data.author.status || 'online',
            createdAt: data.author.created_at,
          }
        : author,
    };
  }

  async getReplies(postId: string): Promise<ForumReplyItem[]> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const { data, error } = await supabase
      .from('forum_replies')
      .select('*, author:profiles(*)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new ServiceError('FORUM_REPLIES_FAILED', error.message, error);
    }

    return (data || []).map((r: any) => ({
      id: r.id,
      authorId: r.author_id,
      authorName: r.author?.display_name || r.author?.username || 'Member',
      avatarUrl: r.author?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${r.author_id}`,
      content: r.content,
      createdAt: r.created_at,
      likes: 0,
    }));
  }

  async addReply(postId: string, author: User, content: string): Promise<ForumReplyItem> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const { data, error } = await supabase
      .from('forum_replies')
      .insert({
        post_id: postId,
        author_id: author.id,
        content: content.trim(),
      })
      .select('*, author:profiles(*)')
      .single();

    if (error) {
      throw new ServiceError('FORUM_REPLY_ADD_FAILED', error.message, error);
    }

    return {
      id: data.id,
      authorId: data.author_id,
      authorName: data.author?.display_name || author.displayName || author.username,
      avatarUrl: data.author?.avatar_url || author.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${data.author_id}`,
      content: data.content,
      createdAt: data.created_at,
      likes: 0,
    };
  }

  async markSolved(postId: string, isSolved: boolean): Promise<void> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const { error } = await supabase
      .from('forum_posts')
      .update({ is_solved: isSolved, updated_at: new Date().toISOString() })
      .eq('id', postId);

    if (error) {
      throw new ServiceError('FORUM_MARK_SOLVED_FAILED', error.message, error);
    }
  }
}

export class SupabaseNotificationRepository implements INotificationRepository {
  async getNotifications(userId: string): Promise<NotificationItem[]> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new ServiceError('NOTIFICATIONS_LOAD_FAILED', `Failed to load notifications: ${error.message}`, error);
    }

    return (data || []).map((n: any) => ({
      id: n.id,
      userId: n.user_id,
      type: n.type,
      sourceId: n.source_id,
      actorId: n.actor_id,
      serverId: n.server_id,
      channelId: n.channel_id,
      conversationId: n.conversation_id,
      content: n.content,
      metadata: n.metadata || {},
      isRead: Boolean(n.is_read),
      createdAt: n.created_at,
    }));
  }

  async markAsRead(notificationId: string): Promise<void> {
    if (!supabase) return;
    await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
  }

  async markAllAsRead(userId: string): Promise<void> {
    if (!supabase) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
  }
}

export class SupabaseReadStateRepository implements IReadStateRepository {
  async getReadStates(userId: string): Promise<Record<string, string>> {
    if (!supabase) return {};

    const { data, error } = await supabase
      .from('read_states')
      .select('channel_id, conversation_id, last_read_at')
      .eq('user_id', userId);

    if (error) return {};

    const record: Record<string, string> = {};
    for (const row of data || []) {
      const key = row.channel_id || row.conversation_id;
      if (key && row.last_read_at) {
        record[key] = row.last_read_at;
      }
    }
    return record;
  }

  async markAsRead(
    userId: string,
    target: { channelId?: string; conversationId?: string; messageId?: string }
  ): Promise<void> {
    if (!supabase || !userId) return;
    const now = new Date().toISOString();

    if (target.channelId) {
      await supabase.from('read_states').upsert({
        user_id: userId,
        channel_id: target.channelId,
        last_read_message_id: target.messageId || null,
        last_read_at: now,
      });
    } else if (target.conversationId) {
      await supabase.from('read_states').upsert({
        user_id: userId,
        conversation_id: target.conversationId,
        last_read_message_id: target.messageId || null,
        last_read_at: now,
      });
    }
  }
}

export class SupabaseStageRepository implements IStageRepository {
  async getStageState(channelId: string): Promise<StageChannelState | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('stage_states')
      .select('*')
      .eq('channel_id', channelId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      channelId: data.channel_id,
      hostId: data.host_id,
      speakers: Array.isArray(data.speakers) ? data.speakers : [],
      handRaisedQueue: Array.isArray(data.hand_raised_queue) ? data.hand_raised_queue : [],
      stageSettings: { isOpen: Boolean(data.is_open) },
    };
  }

  async raiseHand(channelId: string): Promise<void> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');
    const { error } = await supabase.rpc('raise_stage_hand', { p_channel_id: channelId });
    if (error) throw new ServiceError('STAGE_RAISE_HAND_FAILED', error.message, error);
  }

  async lowerHand(channelId: string, targetUserId?: string): Promise<void> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');
    const { error } = await supabase.rpc('lower_stage_hand', {
      p_channel_id: channelId,
      p_target_user_id: targetUserId || null,
    });
    if (error) throw new ServiceError('STAGE_LOWER_HAND_FAILED', error.message, error);
  }

  async moderateSpeaker(channelId: string, targetUserId: string, action: 'invite' | 'demote'): Promise<void> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');
    const { error } = await supabase.rpc('moderate_stage_speaker', {
      p_channel_id: channelId,
      p_target_user_id: targetUserId,
      p_action: action,
    });
    if (error) throw new ServiceError('STAGE_MODERATION_FAILED', error.message, error);
  }
}

export class SupabaseSearchRepository implements ISearchRepository {
  async search(filters: GlobalSearchFilters, accessibleChannelIds: string[] = []): Promise<DetailedSearchResult[]> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');
    const cleanQuery = filters.query.trim().toLowerCase();
    if (!cleanQuery) return [];

    const results: DetailedSearchResult[] = [];

    // 1. Search Messages in accessible channels
    let queryBuilder = supabase
      .from('messages')
      .select(`
        id,
        channel_id,
        content,
        created_at,
        author:profiles(id, username, display_name, avatar_url),
        channel:channels(id, name, server_id)
      `)
      .ilike('content', `%${cleanQuery}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (accessibleChannelIds.length > 0) {
      queryBuilder = queryBuilder.in('channel_id', accessibleChannelIds);
    }

    const { data: messagesData, error: msgErr } = await queryBuilder;
    if (msgErr) {
      throw new ServiceError('SEARCH_FAILED', `Message search failed: ${msgErr.message}`, msgErr);
    }

    if (messagesData) {
      for (const m of messagesData) {
        const author = (m as any).author;
        const channel = (m as any).channel;

        if (
          filters.fromUser &&
          !author?.username?.toLowerCase().includes(filters.fromUser.toLowerCase()) &&
          !author?.display_name?.toLowerCase().includes(filters.fromUser.toLowerCase())
        ) {
          continue;
        }

        if (
          filters.inChannel &&
          !channel?.name?.toLowerCase().includes(filters.inChannel.toLowerCase())
        ) {
          continue;
        }

        results.push({
          id: m.id,
          type: 'message',
          title: author?.display_name || author?.username || 'Member',
          subtitle: m.content,
          channelId: m.channel_id,
          serverId: channel?.server_id,
          messageContent: m.content,
          authorName: author?.display_name || author?.username,
          authorAvatar: author?.avatar_url,
          timestamp: m.created_at,
        });
      }
    }

    // 2. Search Channels
    const { data: channelsData } = await supabase
      .from('channels')
      .select('id, name, type, topic, server_id')
      .ilike('name', `%${cleanQuery}%`)
      .limit(6);

    if (channelsData) {
      for (const c of channelsData) {
        results.push({
          id: c.id,
          type: 'channel',
          title: `#${c.name}`,
          subtitle: c.topic || `${c.type} channel`,
          channelId: c.id,
          serverId: c.server_id,
        });
      }
    }

    // 3. Search Forum Posts
    const { data: forumData } = await supabase
      .from('forum_posts')
      .select('id, channel_id, title, content, created_at, author:profiles(display_name, username)')
      .or(`title.ilike.%${cleanQuery}%,content.ilike.%${cleanQuery}%`)
      .limit(6);

    if (forumData) {
      for (const f of forumData) {
        results.push({
          id: f.id,
          type: 'message',
          title: `[Forum] ${f.title}`,
          subtitle: f.content.slice(0, 100),
          channelId: f.channel_id,
          messageContent: f.content,
          authorName: (f.author as any)?.display_name || (f.author as any)?.username,
          timestamp: f.created_at,
        });
      }
    }

    return results;
  }
}

export class SupabaseFriendRepository implements IFriendRepository {
  async getFriends(userId: string): Promise<Friend[]> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');

    const { data, error } = await supabase
      .from('friends')
      .select('*, friend:profiles!friends_friend_id_fkey(*)')
      .eq('user_id', userId);

    if (error) {
      throw new ServiceError('FRIENDS_LOAD_FAILED', `Failed to load friends: ${error.message}`, error);
    }

    return (data || []).map((f: any) => ({
      id: f.friend?.id || f.friend_id,
      status: f.status || 'accepted',
      createdAt: f.created_at,
      user: {
        id: f.friend?.id || f.friend_id,
        username: f.friend?.username || 'member',
        displayName: f.friend?.display_name || f.friend?.username || 'Member',
        avatarUrl: f.friend?.avatar_url,
        status: f.friend?.status || 'online',
        createdAt: f.friend?.created_at,
      },
    }));
  }

  async addFriend(currentUserId: string, targetUsername: string): Promise<{ success: boolean; user?: User; error?: string }> {
    if (!supabase) throw new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');
    const cleanName = targetUsername.trim();
    if (!cleanName) return { success: false, error: 'Please enter a username.' };

    const { data: targetProfile, error: searchErr } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', cleanName)
      .maybeSingle();

    if (searchErr || !targetProfile) {
      return { success: false, error: `User "@${cleanName}" was not found.` };
    }

    if (targetProfile.id === currentUserId) {
      return { success: false, error: 'You cannot add yourself as a friend.' };
    }

    const { error: insertErr } = await supabase.from('friends').upsert([
      { user_id: currentUserId, friend_id: targetProfile.id, status: 'accepted' },
      { user_id: targetProfile.id, friend_id: currentUserId, status: 'accepted' },
    ]);

    if (insertErr) {
      return { success: false, error: insertErr.message };
    }

    return {
      success: true,
      user: {
        id: targetProfile.id,
        username: targetProfile.username,
        displayName: targetProfile.display_name,
        avatarUrl: targetProfile.avatar_url,
        status: targetProfile.status || 'online',
        createdAt: targetProfile.created_at,
      },
    };
  }

  async acceptFriendRequest(userId: string, friendId: string): Promise<void> {
    if (!supabase) return;
    await supabase
      .from('friends')
      .update({ status: 'accepted' })
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    if (!supabase) return;
    await supabase
      .from('friends')
      .delete()
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);
  }

  async searchUsers(query: string, currentUserId: string): Promise<User[]> {
    if (!supabase) return [];
    const clean = query.trim().toLowerCase();
    if (!clean) return [];

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${clean}%,display_name.ilike.%${clean}%`)
      .neq('id', currentUserId)
      .limit(10);

    if (error || !data) return [];

    return data.map((p: any) => ({
      id: p.id,
      username: p.username,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      bio: p.bio,
      status: p.status || 'online',
      createdAt: p.created_at,
    }));
  }
}
