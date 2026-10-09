-- --------------------------------------------------------------------
-- Meetwo V3 - Resolve Invite RPC Migration
-- Enables secure, public resolution of server invites without exposing
-- internal server rows to arbitrary SELECT operations.
-- --------------------------------------------------------------------

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

  -- Check server exists
  SELECT * INTO v_server
  FROM public.servers
  WHERE id = v_invite.server_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Count members in server
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
    'member_count', v_member_count,
    'is_member', v_is_member
  );
END;
$$;

-- Grant execution to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.resolve_invite(TEXT) TO anon, authenticated;

-- Allow prospective members to view server details for active invites even via direct query
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
