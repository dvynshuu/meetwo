-- ====================================================================
-- MEETWO PRODUCTION SCHEMA MIGRATION: 001_production_schema.sql
-- Run this migration in Supabase Dashboard -> SQL Editor
-- This migration is idempotent (IF NOT EXISTS), safe, and non-destructive.
-- ====================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Update Server Members Role Constraint to support 'moderator'
ALTER TABLE public.server_members DROP CONSTRAINT IF EXISTS server_members_role_check;
ALTER TABLE public.server_members ADD CONSTRAINT server_members_role_check 
  CHECK (role IN ('owner', 'admin', 'moderator', 'member'));

-- 3. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure category_id on channels table
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS category_id UUID DEFAULT NULL;
ALTER TABLE public.channels DROP CONSTRAINT IF EXISTS channels_type_check;
ALTER TABLE public.channels ADD CONSTRAINT channels_type_check 
  CHECK (type IN ('text', 'voice', 'stage', 'forum', 'announcement'));

-- 4. Bookmarks Table (Saved Messages per user)
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  channel_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, message_id)
);

-- 5. Threads & Thread Messages Tables
CREATE TABLE IF NOT EXISTS public.threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (parent_message_id)
);

CREATE TABLE IF NOT EXISTS public.thread_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Forum Posts & Replies Tables
CREATE TABLE IF NOT EXISTS public.forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_solved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.forum_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Direct Message (DM) Conversations & Messages Tables
CREATE TABLE IF NOT EXISTS public.dm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dm_participants (
  conversation_id UUID NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Friends & Friend Requests Tables
CREATE TABLE IF NOT EXISTS public.friends (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'accepted' CHECK (status IN ('accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (sender_id, receiver_id)
);

-- 9. Read States Table (Attention foundation)
CREATE TABLE IF NOT EXISTS public.read_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  last_read_message_id UUID,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT read_states_unique_channel UNIQUE NULLS NOT DISTINCT (user_id, channel_id),
  CONSTRAINT read_states_unique_dm UNIQUE NULLS NOT DISTINCT (user_id, conversation_id)
);

-- 10. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_categories_server ON public.categories(server_id, position);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON public.bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_threads_channel ON public.threads(channel_id);
CREATE INDEX IF NOT EXISTS idx_threads_parent ON public.threads(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_thread_messages_thread ON public.thread_messages(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_channel ON public.forum_posts(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_replies_post ON public.forum_replies(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_dm_participants_user ON public.dm_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_convo ON public.dm_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_friends_user ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON public.friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_read_states_user ON public.read_states(user_id);

-- 11. Enable Replica Identity for Realtime Accuracy
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- 12. Enable Row Level Security (RLS)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.read_states ENABLE ROW LEVEL SECURITY;

-- 13. RLS Policies: Categories
DROP POLICY IF EXISTS "Categories viewable by server members" ON public.categories;
CREATE POLICY "Categories viewable by server members"
  ON public.categories FOR SELECT USING (
    public.is_server_member(server_id, auth.uid()) OR public.is_server_owner(server_id, auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL USING (
    public.is_server_admin_or_owner(server_id, auth.uid())
  );

-- 14. RLS Policies: Bookmarks
DROP POLICY IF EXISTS "Users can view their own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can view their own bookmarks"
  ON public.bookmarks FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can insert their own bookmarks"
  ON public.bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can delete their own bookmarks"
  ON public.bookmarks FOR DELETE USING (auth.uid() = user_id);

-- 15. RLS Policies: Threads & Thread Messages
DROP POLICY IF EXISTS "Thread viewable by channel members" ON public.threads;
CREATE POLICY "Thread viewable by channel members"
  ON public.threads FOR SELECT USING (public.is_channel_member(channel_id, auth.uid()));

DROP POLICY IF EXISTS "Thread insert by channel members" ON public.threads;
CREATE POLICY "Thread insert by channel members"
  ON public.threads FOR INSERT WITH CHECK (public.is_channel_member(channel_id, auth.uid()));

DROP POLICY IF EXISTS "Thread messages viewable by channel members" ON public.thread_messages;
CREATE POLICY "Thread messages viewable by channel members"
  ON public.thread_messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.threads t
      WHERE t.id = thread_messages.thread_id AND public.is_channel_member(t.channel_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Thread messages postable by channel members" ON public.thread_messages;
CREATE POLICY "Thread messages postable by channel members"
  ON public.thread_messages FOR INSERT WITH CHECK (
    auth.uid() = author_id AND
    EXISTS (
      SELECT 1 FROM public.threads t
      WHERE t.id = thread_messages.thread_id AND public.is_channel_member(t.channel_id, auth.uid())
    )
  );

-- 16. RLS Policies: Forums
DROP POLICY IF EXISTS "Forum posts viewable by channel members" ON public.forum_posts;
CREATE POLICY "Forum posts viewable by channel members"
  ON public.forum_posts FOR SELECT USING (public.is_channel_member(channel_id, auth.uid()));

DROP POLICY IF EXISTS "Forum posts insertable by channel members" ON public.forum_posts;
CREATE POLICY "Forum posts insertable by channel members"
  ON public.forum_posts FOR INSERT WITH CHECK (
    auth.uid() = author_id AND public.is_channel_member(channel_id, auth.uid())
  );

DROP POLICY IF EXISTS "Forum replies viewable by channel members" ON public.forum_replies;
CREATE POLICY "Forum replies viewable by channel members"
  ON public.forum_replies FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.forum_posts p
      WHERE p.id = forum_replies.post_id AND public.is_channel_member(p.channel_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Forum replies insertable by channel members" ON public.forum_replies;
CREATE POLICY "Forum replies insertable by channel members"
  ON public.forum_replies FOR INSERT WITH CHECK (
    auth.uid() = author_id AND
    EXISTS (
      SELECT 1 FROM public.forum_posts p
      WHERE p.id = forum_replies.post_id AND public.is_channel_member(p.channel_id, auth.uid())
    )
  );

-- 17. RLS Policies: Direct Messages
CREATE OR REPLACE FUNCTION public.is_dm_participant(p_convo_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dm_participants
    WHERE conversation_id = p_convo_id AND user_id = p_user_id
  );
$$;

DROP POLICY IF EXISTS "Participants can view their dm conversations" ON public.dm_conversations;
CREATE POLICY "Participants can view their dm conversations"
  ON public.dm_conversations FOR SELECT USING (
    public.is_dm_participant(id, auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated users can create dm conversations" ON public.dm_conversations;
CREATE POLICY "Authenticated users can create dm conversations"
  ON public.dm_conversations FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Participants can view dm participants" ON public.dm_participants;
CREATE POLICY "Participants can view dm participants"
  ON public.dm_participants FOR SELECT USING (
    public.is_dm_participant(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated users can join dm participants" ON public.dm_participants;
CREATE POLICY "Authenticated users can join dm participants"
  ON public.dm_participants FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Participants can view dm messages" ON public.dm_messages;
CREATE POLICY "Participants can view dm messages"
  ON public.dm_messages FOR SELECT USING (
    public.is_dm_participant(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "Participants can send dm messages" ON public.dm_messages;
CREATE POLICY "Participants can send dm messages"
  ON public.dm_messages FOR INSERT WITH CHECK (
    auth.uid() = author_id AND public.is_dm_participant(conversation_id, auth.uid())
  );

-- 18. RLS Policies: Friends & Friend Requests
DROP POLICY IF EXISTS "Users can view their friends" ON public.friends;
CREATE POLICY "Users can view their friends"
  ON public.friends FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can manage their friendships" ON public.friends;
CREATE POLICY "Users can manage their friendships"
  ON public.friends FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view relevant friend requests" ON public.friend_requests;
CREATE POLICY "Users can view relevant friend requests"
  ON public.friend_requests FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send friend requests" ON public.friend_requests;
CREATE POLICY "Users can send friend requests"
  ON public.friend_requests FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update received friend requests" ON public.friend_requests;
CREATE POLICY "Users can update received friend requests"
  ON public.friend_requests FOR UPDATE USING (auth.uid() = receiver_id);

-- 19. RLS Policies: Read States
DROP POLICY IF EXISTS "Users can view own read states" ON public.read_states;
CREATE POLICY "Users can view own read states"
  ON public.read_states FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can upsert own read states" ON public.read_states;
CREATE POLICY "Users can upsert own read states"
  ON public.read_states FOR ALL USING (auth.uid() = user_id);

-- 20. Realtime Publications
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_messages;

-- 21. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
