-- ====================================================================
-- MEETWO V2 POSTGRES SCHEMA & REALTIME CONFIGURATION
-- ====================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table
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

-- 2. Servers Table
CREATE TABLE IF NOT EXISTS public.servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon_url TEXT,
  description TEXT DEFAULT '',
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Server Members Table
CREATE TABLE IF NOT EXISTS public.server_members (
  server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (server_id, user_id)
);

-- 4. Channels Table
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  category_id UUID DEFAULT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'voice', 'stage', 'forum', 'announcement')),
  topic TEXT DEFAULT '',
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Messages Table (V2 Enhanced)
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

-- 6. Message Reactions Table (V2)
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);

-- 7. Attachments Table (V2)
CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  content_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Server Invites Table (V2)
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_server_members_user ON public.server_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channels_server ON public.channels(server_id, position);
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON public.messages(channel_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_reactions_message ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_message ON public.attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_invites_code ON public.invites(code);

-- --------------------------------------------------------------------
-- Automatic Profile Creation Trigger on Supabase Auth Signup
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
-- ROW LEVEL SECURITY (RLS) POLICIES
-- --------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- --------------------------------------------------------------------
-- Helper Functions (SECURITY DEFINER to prevent RLS recursion)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_server_member(p_server_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.server_members
    WHERE server_id = p_server_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_server_owner(p_server_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.servers
    WHERE id = p_server_id AND owner_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_server_admin_or_owner(p_server_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.server_members
    WHERE server_id = p_server_id AND user_id = p_user_id AND role IN ('owner', 'admin')
  ) OR EXISTS (
    SELECT 1 FROM public.servers
    WHERE id = p_server_id AND owner_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_channel_member(p_channel_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = p_channel_id
      AND (public.is_server_member(c.server_id, p_user_id) OR public.is_server_owner(c.server_id, p_user_id))
  );
$$;

-- Servers Policies
DROP POLICY IF EXISTS "Servers viewable by members or owners" ON public.servers;
CREATE POLICY "Servers viewable by members or owners"
  ON public.servers FOR SELECT USING (
    owner_id = auth.uid()
    OR public.is_server_member(id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.invites WHERE server_id = public.servers.id)
  );

CREATE POLICY "Authenticated users can create servers"
  ON public.servers FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Server owners can update servers"
  ON public.servers FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Server owners can delete servers"
  ON public.servers FOR DELETE USING (auth.uid() = owner_id);

-- Server Members Policies
DROP POLICY IF EXISTS "Server members can view memberships in their servers" ON public.server_members;
CREATE POLICY "Server members can view memberships in their servers"
  ON public.server_members FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_server_member(server_id, auth.uid())
    OR public.is_server_owner(server_id, auth.uid())
  );

CREATE POLICY "Users can join servers"
  ON public.server_members FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave or owners can remove members" ON public.server_members;
CREATE POLICY "Users can leave or owners can remove members"
  ON public.server_members FOR DELETE USING (
    auth.uid() = user_id
    OR public.is_server_owner(server_id, auth.uid())
  );

-- Channels Policies
DROP POLICY IF EXISTS "Members can view channels of their servers" ON public.channels;
CREATE POLICY "Members can view channels of their servers"
  ON public.channels FOR SELECT USING (
    public.is_server_member(server_id, auth.uid())
    OR public.is_server_owner(server_id, auth.uid())
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
    auth.uid() = author_id AND
    public.is_channel_member(channel_id, auth.uid())
  );

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

CREATE POLICY "Members can toggle reactions"
  ON public.message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);

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

CREATE POLICY "Members can upload attachments"
  ON public.attachments FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = attachments.message_id AND m.author_id = auth.uid()
    )
  );

-- Invites Policies
CREATE POLICY "Invites viewable by anyone"
  ON public.invites FOR SELECT USING (true);

DROP POLICY IF EXISTS "Server members can create invites" ON public.invites;
CREATE POLICY "Server members can create invites"
  ON public.invites FOR INSERT WITH CHECK (
    auth.uid() = creator_id AND
    (public.is_server_member(server_id, auth.uid()) OR public.is_server_owner(server_id, auth.uid()))
  );

CREATE POLICY "Anyone can update invite use counts"
  ON public.invites FOR UPDATE USING (true);

-- Enable Supabase Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
