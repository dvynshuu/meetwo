-- ====================================================================
-- MEETWO PRODUCTION SCHEMA MIGRATION: 002_coherent_production_schema.sql
-- Comprehensive, Idempotent, Production-Hardened Database Schema
-- Run this in Supabase Dashboard -> SQL Editor (or via Supabase CLI migration)
-- ====================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------
-- 2. Base Entity Tables
-- --------------------------------------------------------------------

-- Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  status TEXT DEFAULT 'online' CHECK (status IN ('online', 'idle', 'dnd', 'offline')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Servers Table
CREATE TABLE IF NOT EXISTS public.servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon_url TEXT,
  description TEXT DEFAULT '',
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Server Members Table
CREATE TABLE IF NOT EXISTS public.server_members (
  server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (server_id, user_id)
);

ALTER TABLE public.server_members DROP CONSTRAINT IF EXISTS server_members_role_check;
ALTER TABLE public.server_members ADD CONSTRAINT server_members_role_check
  CHECK (role IN ('owner', 'admin', 'moderator', 'member'));

-- Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Channels Table
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  topic TEXT DEFAULT '',
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.channels DROP CONSTRAINT IF EXISTS channels_type_check;
ALTER TABLE public.channels ADD CONSTRAINT channels_type_check
  CHECK (type IN ('text', 'voice', 'stage', 'forum', 'announcement'));

-- Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  is_edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message Reactions Table
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);

-- Attachments Table
CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  content_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invites Table
CREATE TABLE IF NOT EXISTS public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  uses_count INT DEFAULT 0,
  max_uses INT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookmarks Table
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  channel_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, message_id)
);

-- Threads Table
CREATE TABLE IF NOT EXISTS public.threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (parent_message_id)
);

-- Thread Messages Table
CREATE TABLE IF NOT EXISTS public.thread_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Forum Posts Table
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

-- Forum Replies Table
CREATE TABLE IF NOT EXISTS public.forum_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DM Conversations Table
CREATE TABLE IF NOT EXISTS public.dm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DM Participants Table
CREATE TABLE IF NOT EXISTS public.dm_participants (
  conversation_id UUID NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

-- DM Messages Table
CREATE TABLE IF NOT EXISTS public.dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Friends Table
CREATE TABLE IF NOT EXISTS public.friends (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'accepted' CHECK (status IN ('accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);

-- Friend Requests Table
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (sender_id, receiver_id)
);

-- Read States Table
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

-- --------------------------------------------------------------------
-- 3. Attention Architecture: Persistent Notifications Table
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mention', 'reply', 'dm', 'invite', 'system')),
  source_id UUID,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 4. Server-Authoritative Stage State Machine Table
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stage_states (
  channel_id UUID PRIMARY KEY REFERENCES public.channels(id) ON DELETE CASCADE,
  host_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  speakers UUID[] DEFAULT '{}',
  hand_raised_queue UUID[] DEFAULT '{}',
  is_open BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 5. Performance Indexes
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_server_members_user ON public.server_members(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_server ON public.categories(server_id, position);
CREATE INDEX IF NOT EXISTS idx_channels_server ON public.channels(server_id, position);
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON public.messages(channel_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_reactions_message ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_message ON public.attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_invites_code ON public.invites(code);
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
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stage_states_channel ON public.stage_states(channel_id);

-- Full-Text search indexes for high-speed message search
CREATE INDEX IF NOT EXISTS idx_messages_content_trgm ON public.messages USING gin(to_tsvector('english', content));

-- --------------------------------------------------------------------
-- 6. Storage Bucket Configuration (Attachments)
-- --------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  true,
  26214400, -- 25MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg', 'audio/wav',
    'application/pdf', 'text/plain', 'text/markdown', 'application/zip', 'application/json'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 26214400;

-- --------------------------------------------------------------------
-- 7. Helper Security Functions (SECURITY DEFINER to prevent recursion)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_server_member(p_server_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.server_members
    WHERE server_id = p_server_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_server_owner(p_server_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.servers
    WHERE id = p_server_id AND owner_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_server_admin_or_owner(p_server_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.server_members
    WHERE server_id = p_server_id AND user_id = p_user_id AND role IN ('owner', 'admin')
  ) OR EXISTS (
    SELECT 1 FROM public.servers
    WHERE id = p_server_id AND owner_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_channel_member(p_channel_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = p_channel_id
      AND (public.is_server_member(c.server_id, p_user_id) OR public.is_server_owner(c.server_id, p_user_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_dm_participant(p_convo_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dm_participants
    WHERE conversation_id = p_convo_id AND user_id = p_user_id
  );
$$;

-- --------------------------------------------------------------------
-- 8. Secure RPC Functions (Atomic Server-Side Authorization)
-- --------------------------------------------------------------------

-- Secure Invite Join: Validates code, expiration, max uses atomically
CREATE OR REPLACE FUNCTION public.join_server_with_invite(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_invite RECORD;
  v_server RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to join server';
  END IF;

  -- Select and lock invite row
  SELECT * INTO v_invite
  FROM public.invites
  WHERE UPPER(code) = UPPER(TRIM(p_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND: Invalid invite code';
  END IF;

  -- Check expiration
  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN
    RAISE EXCEPTION 'INVITE_EXPIRED: This invite has expired';
  END IF;

  -- Check max uses
  IF v_invite.max_uses IS NOT NULL AND v_invite.uses_count >= v_invite.max_uses THEN
    RAISE EXCEPTION 'INVITE_EXHAUSTED: This invite has reached its maximum uses';
  END IF;

  -- Check server exists
  SELECT * INTO v_server FROM public.servers WHERE id = v_invite.server_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERVER_NOT_FOUND: Workspace does not exist';
  END IF;

  -- Add membership (idempotent upsert)
  INSERT INTO public.server_members (server_id, user_id, role, joined_at)
  VALUES (v_invite.server_id, v_user_id, 'member', NOW())
  ON CONFLICT (server_id, user_id) DO NOTHING;

  -- Increment use count
  UPDATE public.invites
  SET uses_count = uses_count + 1
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success', true,
    'server_id', v_server.id,
    'server_name', v_server.name,
    'icon_url', v_server.icon_url
  );
END;
$$;

-- Stage Hand Raising RPC
CREATE OR REPLACE FUNCTION public.raise_stage_hand(p_channel_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_channel_member(p_channel_id, v_user_id) THEN
    RAISE EXCEPTION 'User is not a member of this channel';
  END IF;

  INSERT INTO public.stage_states (channel_id, hand_raised_queue, updated_at)
  VALUES (p_channel_id, ARRAY[v_user_id], NOW())
  ON CONFLICT (channel_id) DO UPDATE
  SET hand_raised_queue = array_append(
    array_remove(public.stage_states.hand_raised_queue, v_user_id),
    v_user_id
  ),
  updated_at = NOW();
END;
$$;

-- Stage Lower Hand RPC
CREATE OR REPLACE FUNCTION public.lower_stage_hand(p_channel_id UUID, p_target_user_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_target_id UUID;
  v_channel RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_target_id := COALESCE(p_target_user_id, v_user_id);

  -- If moderating another user, verify moderator/admin/owner or stage host
  IF v_target_id != v_user_id THEN
    SELECT * INTO v_channel FROM public.channels WHERE id = p_channel_id;
    IF NOT public.is_server_admin_or_owner(v_channel.server_id, v_user_id) THEN
      SELECT 1 FROM public.stage_states WHERE channel_id = p_channel_id AND host_id = v_user_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Only moderators or stage host can lower participant hand';
      END IF;
    END IF;
  END IF;

  UPDATE public.stage_states
  SET hand_raised_queue = array_remove(hand_raised_queue, v_target_id),
      updated_at = NOW()
  WHERE channel_id = p_channel_id;
END;
$$;

-- Stage Moderate Speaker RPC (Invite / Demote)
CREATE OR REPLACE FUNCTION public.moderate_stage_speaker(
  p_channel_id UUID,
  p_target_user_id UUID,
  p_action TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_channel RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_channel FROM public.channels WHERE id = p_channel_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  IF NOT (public.is_server_admin_or_owner(v_channel.server_id, v_user_id) OR
          EXISTS(SELECT 1 FROM public.stage_states WHERE channel_id = p_channel_id AND host_id = v_user_id)) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Only moderators or stage host can manage speakers';
  END IF;

  IF p_action = 'invite' THEN
    UPDATE public.stage_states
    SET speakers = array_append(array_remove(speakers, p_target_user_id), p_target_user_id),
        hand_raised_queue = array_remove(hand_raised_queue, p_target_user_id),
        updated_at = NOW()
    WHERE channel_id = p_channel_id;
  ELSIF p_action = 'demote' THEN
    UPDATE public.stage_states
    SET speakers = array_remove(speakers, p_target_user_id),
        updated_at = NOW()
    WHERE channel_id = p_channel_id;
  END IF;
END;
$$;

-- --------------------------------------------------------------------
-- 9. Automatic Profile Creation on Signup Trigger
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url, bio, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/bottts/svg?seed=' || NEW.id),
    'Hey there! I am using Meetwo.',
    'online'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------------------
-- 10. Automated Mention & Reply Notification Trigger
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_message_notifications()
RETURNS TRIGGER AS $$
DECLARE
  v_channel RECORD;
  v_reply_msg RECORD;
  v_actor_name TEXT;
  v_mentioned_user RECORD;
BEGIN
  -- Fetch channel and server info
  SELECT c.*, s.name AS server_name INTO v_channel
  FROM public.channels c
  JOIN public.servers s ON s.id = c.server_id
  WHERE c.id = NEW.channel_id;

  -- Fetch actor display name
  SELECT COALESCE(display_name, username) INTO v_actor_name
  FROM public.profiles
  WHERE id = NEW.author_id;

  -- 1. Handle Replies
  IF NEW.reply_to_id IS NOT NULL THEN
    SELECT * INTO v_reply_msg FROM public.messages WHERE id = NEW.reply_to_id;
    IF FOUND AND v_reply_msg.author_id != NEW.author_id THEN
      INSERT INTO public.notifications (
        user_id, type, source_id, actor_id, server_id, channel_id, content, metadata
      )
      VALUES (
        v_reply_msg.author_id,
        'reply',
        NEW.id,
        NEW.author_id,
        v_channel.server_id,
        NEW.channel_id,
        NEW.content,
        jsonb_build_object(
          'serverName', v_channel.server_name,
          'channelName', v_channel.name,
          'actorName', v_actor_name
        )
      );
    END IF;
  END IF;

  -- 2. Handle Username Mentions (@username)
  FOR v_mentioned_user IN
    SELECT p.id, p.username
    FROM public.profiles p
    JOIN public.server_members sm ON sm.user_id = p.id AND sm.server_id = v_channel.server_id
    WHERE p.id != NEW.author_id
      AND NEW.content ~* ('@' || p.username || '\M')
  LOOP
    INSERT INTO public.notifications (
      user_id, type, source_id, actor_id, server_id, channel_id, content, metadata
    )
    VALUES (
      v_mentioned_user.id,
      'mention',
      NEW.id,
      NEW.author_id,
      v_channel.server_id,
      NEW.channel_id,
      NEW.content,
      jsonb_build_object(
        'serverName', v_channel.server_name,
        'channelName', v_channel.name,
        'actorName', v_actor_name
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_created_notify ON public.messages;
CREATE TRIGGER on_message_created_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_message_notifications();

-- --------------------------------------------------------------------
-- 11. Row Level Security (RLS) - Hardened Configuration
-- --------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_states ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Servers Policies
DROP POLICY IF EXISTS "Servers viewable by members or owners" ON public.servers;
CREATE POLICY "Servers viewable by members or owners"
  ON public.servers FOR SELECT USING (
    owner_id = auth.uid() OR public.is_server_member(id, auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated users can create servers" ON public.servers;
CREATE POLICY "Authenticated users can create servers"
  ON public.servers FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Server owners can update servers" ON public.servers;
CREATE POLICY "Server owners can update servers"
  ON public.servers FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Server owners can delete servers" ON public.servers;
CREATE POLICY "Server owners can delete servers"
  ON public.servers FOR DELETE USING (auth.uid() = owner_id);

-- Server Members Policies (Secured: No arbitrary open INSERT)
DROP POLICY IF EXISTS "Server members can view memberships in their servers" ON public.server_members;
CREATE POLICY "Server members can view memberships in their servers"
  ON public.server_members FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_server_member(server_id, auth.uid())
    OR public.is_server_owner(server_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can join servers" ON public.server_members;
DROP POLICY IF EXISTS "Server owners can add initial owner membership" ON public.server_members;
CREATE POLICY "Server owners can add initial owner membership"
  ON public.server_members FOR INSERT WITH CHECK (
    auth.uid() = user_id AND (
      public.is_server_owner(server_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can leave or owners can remove members" ON public.server_members;
CREATE POLICY "Users can leave or owners can remove members"
  ON public.server_members FOR DELETE USING (
    auth.uid() = user_id OR public.is_server_owner(server_id, auth.uid())
  );

-- Categories Policies
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

-- Channels Policies
DROP POLICY IF EXISTS "Members can view channels of their servers" ON public.channels;
CREATE POLICY "Members can view channels of their servers"
  ON public.channels FOR SELECT USING (
    public.is_server_member(server_id, auth.uid()) OR public.is_server_owner(server_id, auth.uid())
  );

DROP POLICY IF EXISTS "Server owners and admins can manage channels" ON public.channels;
CREATE POLICY "Server owners and admins can manage channels"
  ON public.channels FOR ALL USING (
    public.is_server_admin_or_owner(server_id, auth.uid())
  );

-- Messages Policies
DROP POLICY IF EXISTS "Channel server members can view messages" ON public.messages;
CREATE POLICY "Channel server members can view messages"
  ON public.messages FOR SELECT USING (
    public.is_channel_member(channel_id, auth.uid())
  );

DROP POLICY IF EXISTS "Channel server members can post messages" ON public.messages;
CREATE POLICY "Channel server members can post messages"
  ON public.messages FOR INSERT WITH CHECK (
    auth.uid() = author_id AND public.is_channel_member(channel_id, auth.uid())
  );

DROP POLICY IF EXISTS "Authors can update their own messages" ON public.messages;
CREATE POLICY "Authors can update their own messages"
  ON public.messages FOR UPDATE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors or server owners can delete messages" ON public.messages;
CREATE POLICY "Authors or server owners can delete messages"
  ON public.messages FOR DELETE USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = messages.channel_id AND public.is_server_owner(c.server_id, auth.uid())
    )
  );

-- Reactions Policies
DROP POLICY IF EXISTS "Members can view reactions" ON public.message_reactions;
CREATE POLICY "Members can view reactions"
  ON public.message_reactions FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_reactions.message_id AND public.is_channel_member(m.channel_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can toggle reactions" ON public.message_reactions;
CREATE POLICY "Members can toggle reactions"
  ON public.message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove own reactions" ON public.message_reactions;
CREATE POLICY "Users can remove own reactions"
  ON public.message_reactions FOR DELETE USING (auth.uid() = user_id);

-- Attachments Policies
DROP POLICY IF EXISTS "Members can view attachments" ON public.attachments;
CREATE POLICY "Members can view attachments"
  ON public.attachments FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = attachments.message_id AND public.is_channel_member(m.channel_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can upload attachments" ON public.attachments;
CREATE POLICY "Members can upload attachments"
  ON public.attachments FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = attachments.message_id AND m.author_id = auth.uid()
    )
  );

-- Invites Policies (Secured: No arbitrary open UPDATE)
DROP POLICY IF EXISTS "Invites viewable by anyone" ON public.invites;
CREATE POLICY "Invites viewable by anyone"
  ON public.invites FOR SELECT USING (true);

DROP POLICY IF EXISTS "Server members can create invites" ON public.invites;
CREATE POLICY "Server members can create invites"
  ON public.invites FOR INSERT WITH CHECK (
    auth.uid() = creator_id AND
    (public.is_server_member(server_id, auth.uid()) OR public.is_server_owner(server_id, auth.uid()))
  );

DROP POLICY IF EXISTS "Anyone can update invite use counts" ON public.invites;
DROP POLICY IF EXISTS "Server admins can manage invites" ON public.invites;
CREATE POLICY "Server admins can manage invites"
  ON public.invites FOR UPDATE USING (
    public.is_server_admin_or_owner(server_id, auth.uid())
  );

-- Bookmarks Policies
DROP POLICY IF EXISTS "Users can view their own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can view their own bookmarks"
  ON public.bookmarks FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can insert their own bookmarks"
  ON public.bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can delete their own bookmarks"
  ON public.bookmarks FOR DELETE USING (auth.uid() = user_id);

-- Threads & Thread Messages Policies
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

-- Forum Posts & Replies Policies
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

-- Direct Messages Policies
DROP POLICY IF EXISTS "Participants can view their dm conversations" ON public.dm_conversations;
CREATE POLICY "Participants can view their dm conversations"
  ON public.dm_conversations FOR SELECT USING (public.is_dm_participant(id, auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can create dm conversations" ON public.dm_conversations;
CREATE POLICY "Authenticated users can create dm conversations"
  ON public.dm_conversations FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Participants can view dm participants" ON public.dm_participants;
CREATE POLICY "Participants can view dm participants"
  ON public.dm_participants FOR SELECT USING (public.is_dm_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can join dm participants" ON public.dm_participants;
CREATE POLICY "Authenticated users can join dm participants"
  ON public.dm_participants FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Participants can view dm messages" ON public.dm_messages;
CREATE POLICY "Participants can view dm messages"
  ON public.dm_messages FOR SELECT USING (public.is_dm_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Participants can send dm messages" ON public.dm_messages;
CREATE POLICY "Participants can send dm messages"
  ON public.dm_messages FOR INSERT WITH CHECK (
    auth.uid() = author_id AND public.is_dm_participant(conversation_id, auth.uid())
  );

-- Friends Policies
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

-- Read States Policies
DROP POLICY IF EXISTS "Users can view own read states" ON public.read_states;
CREATE POLICY "Users can view own read states"
  ON public.read_states FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can upsert own read states" ON public.read_states;
CREATE POLICY "Users can upsert own read states"
  ON public.read_states FOR ALL USING (auth.uid() = user_id);

-- Notifications Policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- Stage States Policies
DROP POLICY IF EXISTS "Channel members can view stage state" ON public.stage_states;
CREATE POLICY "Channel members can view stage state"
  ON public.stage_states FOR SELECT USING (
    public.is_channel_member(channel_id, auth.uid())
  );

-- --------------------------------------------------------------------
-- 12. Realtime Publications & Replica Identity
-- --------------------------------------------------------------------
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.dm_messages REPLICA IDENTITY FULL;
ALTER TABLE public.thread_messages REPLICA IDENTITY FULL;
ALTER TABLE public.forum_posts REPLICA IDENTITY FULL;
ALTER TABLE public.forum_replies REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.stage_states REPLICA IDENTITY FULL;
ALTER TABLE public.read_states REPLICA IDENTITY FULL;

-- Add tables to realtime publication if not already present
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  EXCEPTION WHEN duplicate_object THEN END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages;
  EXCEPTION WHEN duplicate_object THEN END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_messages;
  EXCEPTION WHEN duplicate_object THEN END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_posts;
  EXCEPTION WHEN duplicate_object THEN END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_replies;
  EXCEPTION WHEN duplicate_object THEN END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stage_states;
  EXCEPTION WHEN duplicate_object THEN END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.read_states;
  EXCEPTION WHEN duplicate_object THEN END;
END $$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
