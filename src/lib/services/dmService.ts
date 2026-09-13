import { supabase, isSupabaseConfigured } from '../supabase/client';
import { DMConversation, DMMessage, User } from '../../types';

export class DMService {
  /**
   * Retrieves all DM conversations for a user with participant profiles and latest message.
   */
  public static async getConversations(userId: string): Promise<DMConversation[]> {
    if (isSupabaseConfigured && supabase && userId) {
      try {
        // 1. Fetch conversations this user is participating in
        const { data: participations, error } = await supabase
          .from('dm_participants')
          .select('conversation_id')
          .eq('user_id', userId);

        if (!error && participations && participations.length > 0) {
          const conversationIds = participations.map((p: any) => p.conversation_id);

          // 2. Fetch all participants for these conversations
          const { data: allParticipants } = await supabase
            .from('dm_participants')
            .select('conversation_id, user:profiles(*)')
            .in('conversation_id', conversationIds);

          // 3. Fetch latest messages for these conversations
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
      } catch (err) {
        console.warn('[DMService] getConversations error, falling back to local:', err);
      }
    }

    try {
      const saved = localStorage.getItem('mw:dm:conversations');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  /**
   * Starts a 1:1 conversation with another user or returns the existing conversation ID.
   */
  public static async startConversation(currentUser: User, targetUser: User): Promise<string> {
    if (isSupabaseConfigured && supabase && currentUser.id && targetUser.id) {
      try {
        // Check if a conversation between these two already exists
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

        // Create new conversation
        const { data: newConvo, error: convoErr } = await supabase
          .from('dm_conversations')
          .insert({})
          .select('id')
          .single();

        if (!convoErr && newConvo?.id) {
          await supabase.from('dm_participants').insert([
            { conversation_id: newConvo.id, user_id: currentUser.id },
            { conversation_id: newConvo.id, user_id: targetUser.id },
          ]);
          return newConvo.id;
        }
      } catch (err) {
        console.warn('[DMService] startConversation failed:', err);
      }
    }

    return `convo-${currentUser.id}-${targetUser.id}`;
  }

  /**
   * Fetches messages for a specific conversation.
   */
  public static async getMessages(conversationId: string): Promise<DMMessage[]> {
    if (isSupabaseConfigured && supabase && conversationId) {
      try {
        const { data, error } = await supabase
          .from('dm_messages')
          .select('*, author:profiles(*)')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          return data.map((m: any) => ({
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
      } catch (err) {
        console.warn('[DMService] getMessages error:', err);
      }
    }

    try {
      const allMessages = JSON.parse(localStorage.getItem('mw:dm:messages') || '{}');
      return allMessages[conversationId] || [];
    } catch {
      return [];
    }
  }

  /**
   * Sends a message in a DM conversation.
   */
  public static async sendMessage(
    conversationId: string,
    author: User,
    content: string
  ): Promise<DMMessage> {
    const cleanContent = content.trim();
    if (!cleanContent) throw new Error('Message content cannot be empty.');

    const optimisticMsg: DMMessage = {
      id: `dm-${Date.now()}`,
      conversationId,
      authorId: author.id,
      content: cleanContent,
      createdAt: new Date().toISOString(),
      author,
    };

    if (isSupabaseConfigured && supabase && author.id) {
      try {
        const { data, error } = await supabase
          .from('dm_messages')
          .insert({
            conversation_id: conversationId,
            author_id: author.id,
            content: cleanContent,
          })
          .select('*, author:profiles(*)')
          .single();

        if (!error && data) {
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
      } catch (err) {
        console.warn('[DMService] sendMessage error:', err);
      }
    }

    // Dev/Local fallback persistence
    try {
      const allMessages = JSON.parse(localStorage.getItem('mw:dm:messages') || '{}');
      const list = allMessages[conversationId] || [];
      list.push(optimisticMsg);
      allMessages[conversationId] = list;
      localStorage.setItem('mw:dm:messages', JSON.stringify(allMessages));
    } catch {}

    return optimisticMsg;
  }
}
