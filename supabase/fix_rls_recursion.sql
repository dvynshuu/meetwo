-- ====================================================================
-- FIX: Infinite Recursion Detected in Policy for Relation "server_members"
-- Run this script in your Supabase Dashboard -> SQL Editor
-- ====================================================================

-- 1. Create SECURITY DEFINER Helper Functions
-- (SECURITY DEFINER runs with elevated privileges, bypassing RLS recursion)

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

-- 2. Drop the Recursive Policies
DROP POLICY IF EXISTS "Servers viewable by members or owners" ON public.servers;
DROP POLICY IF EXISTS "Server members can view memberships in their servers" ON public.server_members;
DROP POLICY IF EXISTS "Users can leave or owners can remove members" ON public.server_members;
DROP POLICY IF EXISTS "Members can view channels of their servers" ON public.channels;
DROP POLICY IF EXISTS "Server owners and admins can manage channels" ON public.channels;
DROP POLICY IF EXISTS "Channel server members can view messages" ON public.messages;
DROP POLICY IF EXISTS "Channel server members can post messages" ON public.messages;
DROP POLICY IF EXISTS "Authors or server owners can delete messages" ON public.messages;
DROP POLICY IF EXISTS "Members can view reactions" ON public.message_reactions;
DROP POLICY IF EXISTS "Members can view attachments" ON public.attachments;
DROP POLICY IF EXISTS "Server members can create invites" ON public.invites;

-- 3. Re-create Clean, Non-Recursive Policies

-- Servers: Viewable by server owner or verified member
CREATE POLICY "Servers viewable by members or owners"
  ON public.servers FOR SELECT USING (
    owner_id = auth.uid() OR public.is_server_member(id, auth.uid())
  );

-- Server Members: Viewable by self, server members, or server owner
CREATE POLICY "Server members can view memberships in their servers"
  ON public.server_members FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_server_member(server_id, auth.uid())
    OR public.is_server_owner(server_id, auth.uid())
  );

CREATE POLICY "Users can leave or owners can remove members"
  ON public.server_members FOR DELETE USING (
    auth.uid() = user_id
    OR public.is_server_owner(server_id, auth.uid())
  );

-- Channels: Viewable by server members or server owner
CREATE POLICY "Members can view channels of their servers"
  ON public.channels FOR SELECT USING (
    public.is_server_member(server_id, auth.uid())
    OR public.is_server_owner(server_id, auth.uid())
  );

CREATE POLICY "Server owners and admins can manage channels"
  ON public.channels FOR ALL USING (
    public.is_server_admin_or_owner(server_id, auth.uid())
  );

-- Messages: Viewable and postable by channel's server members
CREATE POLICY "Channel server members can view messages"
  ON public.messages FOR SELECT USING (
    public.is_channel_member(channel_id, auth.uid())
  );

CREATE POLICY "Channel server members can post messages"
  ON public.messages FOR INSERT WITH CHECK (
    auth.uid() = author_id AND
    public.is_channel_member(channel_id, auth.uid())
  );

CREATE POLICY "Authors or server owners can delete messages"
  ON public.messages FOR DELETE USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = messages.channel_id AND public.is_server_owner(c.server_id, auth.uid())
    )
  );

-- Reactions & Attachments
CREATE POLICY "Members can view reactions"
  ON public.message_reactions FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_reactions.message_id AND public.is_channel_member(m.channel_id, auth.uid())
    )
  );

-- Attachments
CREATE POLICY "Members can view attachments"
  ON public.attachments FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = attachments.message_id AND public.is_channel_member(m.channel_id, auth.uid())
    )
  );

-- Invites
CREATE POLICY "Server members can create invites"
  ON public.invites FOR INSERT WITH CHECK (
    auth.uid() = creator_id AND
    (public.is_server_member(server_id, auth.uid()) OR public.is_server_owner(server_id, auth.uid()))
  );
