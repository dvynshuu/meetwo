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
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'voice')),
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

-- Servers Policies
CREATE POLICY "Servers viewable by members or owners"
  ON public.servers FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.server_members WHERE server_id = id AND user_id = auth.uid())
    OR owner_id = auth.uid()
  );

CREATE POLICY "Authenticated users can create servers"
  ON public.servers FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Server owners can update servers"
  ON public.servers FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Server owners can delete servers"
  ON public.servers FOR DELETE USING (auth.uid() = owner_id);

-- Server Members Policies
CREATE POLICY "Server members can view memberships in their servers"
  ON public.server_members FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.server_members sm WHERE sm.server_id = server_members.server_id AND sm.user_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can join servers"
  ON public.server_members FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave or owners can remove members"
  ON public.server_members FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.servers s WHERE s.id = server_members.server_id AND s.owner_id = auth.uid())
  );

-- Channels Policies
CREATE POLICY "Members can view channels of their servers"
  ON public.channels FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.server_members sm WHERE sm.server_id = channels.server_id AND sm.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.servers s WHERE s.id = channels.server_id AND s.owner_id = auth.uid())
  );

CREATE POLICY "Server owners and admins can manage channels"
  ON public.channels FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.server_members sm
      WHERE sm.server_id = channels.server_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM public.servers s WHERE s.id = channels.server_id AND s.owner_id = auth.uid())
  );

-- Messages Policies
CREATE POLICY "Channel server members can view messages"
  ON public.messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.channels c
      JOIN public.server_members sm ON sm.server_id = c.server_id
      WHERE c.id = messages.channel_id AND sm.user_id = auth.uid()
    )
  );

CREATE POLICY "Channel server members can post messages"
  ON public.messages FOR INSERT WITH CHECK (
    auth.uid() = author_id AND
    EXISTS (
      SELECT 1 FROM public.channels c
      JOIN public.server_members sm ON sm.server_id = c.server_id
      WHERE c.id = messages.channel_id AND sm.user_id = auth.uid()
    )
  );

CREATE POLICY "Authors can update their own messages"
  ON public.messages FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Authors or server owners can delete messages"
  ON public.messages FOR DELETE USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.channels c
      JOIN public.servers s ON s.id = c.server_id
      WHERE c.id = messages.channel_id AND s.owner_id = auth.uid()
    )
  );

-- Reactions Policies
CREATE POLICY "Members can view reactions"
  ON public.message_reactions FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.channels c ON c.id = m.channel_id
      JOIN public.server_members sm ON sm.server_id = c.server_id
      WHERE m.id = message_reactions.message_id AND sm.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can toggle reactions"
  ON public.message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions"
  ON public.message_reactions FOR DELETE USING (auth.uid() = user_id);

-- Attachments Policies
CREATE POLICY "Members can view attachments"
  ON public.attachments FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.channels c ON c.id = m.channel_id
      JOIN public.server_members sm ON sm.server_id = c.server_id
      WHERE m.id = attachments.message_id AND sm.user_id = auth.uid()
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

CREATE POLICY "Server members can create invites"
  ON public.invites FOR INSERT WITH CHECK (
    auth.uid() = creator_id AND
    EXISTS (SELECT 1 FROM public.server_members sm WHERE sm.server_id = invites.server_id AND sm.user_id = auth.uid())
  );

-- Enable Supabase Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
