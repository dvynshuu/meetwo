-- ====================================================================
-- MEETWO V3 - FIX INVITES & SERVER MEMBERSHIP AUTHORIZATION
-- Run this migration in Supabase Dashboard -> SQL Editor
-- This enables seamless invite preview and server joining.
-- ====================================================================

-- 1. Function: resolve_invite(p_code TEXT)
-- Allows any prospective member to safely view server metadata for an invite
CREATE OR REPLACE FUNCTION public.resolve_invite(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_server RECORD;
  v_member_count BIGINT;
  v_is_member BOOLEAN := false;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Select invite row
  SELECT * INTO v_invite
  FROM public.invites
  WHERE UPPER(code) = UPPER(TRIM(p_code));

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Check expiration
  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN
    RETURN NULL;
  END IF;

  -- Check max uses
  IF v_invite.max_uses IS NOT NULL AND v_invite.uses_count >= v_invite.max_uses THEN
    RETURN NULL;
  END IF;

  -- Select server record (bypasses RLS via SECURITY DEFINER)
  SELECT * INTO v_server
  FROM public.servers
  WHERE id = v_invite.server_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Count total members in server
  SELECT COUNT(*) INTO v_member_count
  FROM public.server_members
  WHERE server_id = v_server.id;

  -- Check if caller is already a member
  IF v_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.server_members
      WHERE server_id = v_server.id AND user_id = v_user_id
    ) INTO v_is_member;
  END IF;

  RETURN jsonb_build_object(
    'invite', jsonb_build_object(
      'id', v_invite.id,
      'server_id', v_invite.server_id,
      'code', v_invite.code,
      'creator_id', v_invite.creator_id,
      'expires_at', v_invite.expires_at,
      'uses_count', v_invite.uses_count,
      'max_uses', v_invite.max_uses,
      'created_at', v_invite.created_at
    ),
    'server', jsonb_build_object(
      'id', v_server.id,
      'name', v_server.name,
      'icon_url', v_server.icon_url,
      'description', v_server.description,
      'owner_id', v_server.owner_id,
      'created_at', v_server.created_at
    ),
    'member_count', COALESCE(v_member_count, 1),
    'is_member', v_is_member
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_invite(TEXT) TO anon, authenticated;


-- 2. Function: join_server_with_invite(p_code TEXT)
-- Atomically validates code, adds membership, and increments uses count
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

  -- Verify server exists
  SELECT * INTO v_server FROM public.servers WHERE id = v_invite.server_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERVER_NOT_FOUND: Server does not exist';
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

GRANT EXECUTE ON FUNCTION public.join_server_with_invite(TEXT) TO authenticated;


-- 3. RLS Policy: Allow prospective members with an active invite to read basic server details
DROP POLICY IF EXISTS "Servers viewable with active invite" ON public.servers;
CREATE POLICY "Servers viewable with active invite"
  ON public.servers FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.invites
      WHERE invites.server_id = servers.id
        AND (invites.expires_at IS NULL OR invites.expires_at > NOW())
        AND (invites.max_uses IS NULL OR invites.uses_count < invites.max_uses)
    )
  );

-- 4. RLS Policy: Allow authenticated users to join servers
DROP POLICY IF EXISTS "Users can join servers" ON public.server_members;
CREATE POLICY "Users can join servers"
  ON public.server_members FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );
